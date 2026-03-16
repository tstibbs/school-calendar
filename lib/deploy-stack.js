import {resolve, dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {readFileSync} from 'node:fs'

import {Stack, Annotations, RemovalPolicy, Duration, CfnOutput} from 'aws-cdk-lib'
import {Bucket, BucketEncryption, EventType} from 'aws-cdk-lib/aws-s3'
import {
	Function,
	FunctionCode,
	Distribution,
	ViewerProtocolPolicy,
	AllowedMethods,
	FunctionEventType
} from 'aws-cdk-lib/aws-cloudfront'
import {S3BucketOrigin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {PolicyStatement, AnyPrincipal, ServicePrincipal, Role} from 'aws-cdk-lib/aws-iam'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {NodejsFunction, OutputFormat} from 'aws-cdk-lib/aws-lambda-nodejs'
import {LambdaDestination} from 'aws-cdk-lib/aws-s3-notifications'
import {Asset} from 'aws-cdk-lib/aws-s3-assets'
import {CfnSkill} from 'aws-cdk-lib/alexa-ask'

import {INPUTS} from '../src/config.js' // for validation only

import {
	AMZN_SKILL_ID,
	ALEXA_VENDOR_ID,
	ALEXA_CLIENT_ID,
	ALEXA_CLIENT_SECRET,
	ALEXA_REFRESH_TOKEN
} from './deploy-envs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

class DeployStack extends Stack {
	#bucket
	#skillLambda

	constructor(scope, id, props) {
		super(scope, id, props)

		this.validateConfig()
		this.deployBackend()
		this.deploySkill()
		this.deployCloudfront()
	}

	validateConfig() {
		//this has no effect on the deployed stack, but this is our only chance to validate the config
		//this regex must match the regex in cloudfront-auth.js
		const nonMatches = Object.keys(INPUTS).filter(input => !/^[\w-_]+$/.test(input))
		if (nonMatches.length > 0) {
			throw new Error(`The following input names are in an invalid format: ${nonMatches.join(', ')}`)
		}
	}

	#buildLambda(stack, entry, timeout, outputType, envs = {}) {
		const handler = new NodejsFunction(stack, entry, {
			entry: resolve(__dirname, `../src/${entry}.js`),
			memorySize: 128,
			timeout: timeout,
			runtime: Runtime.NODEJS_22_X,
			environment: envs,
			bundling: {
				commandHooks: {
					beforeBundling() {
						return []
					},
					beforeInstall() {
						return []
					},
					afterBundling(inputDir, outputDir) {
						return [
							`cp ${inputDir}/config-defaults.yaml ${outputDir}`,
							`cp ${inputDir}/config.yaml ${outputDir}`,
							`cp ${inputDir}/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs ${outputDir}`
						]
					}
				},
				format: outputType
			}
		})
		return handler
	}

	deployBackend() {
		this.#bucket = new Bucket(this, 'files', {
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
			autoDeleteObjects: true
		})
		Annotations.of(this.#bucket).acknowledgeWarning('@aws-cdk/aws-s3:accessLogsPolicyNotAdded')

		const docExtractor = this.#buildLambda(this, 'doc-extractor', Duration.minutes(2), OutputFormat.ESM)
		docExtractor.addToRolePolicy(
			new PolicyStatement({
				resources: ['*'],
				actions: ['bedrock:InvokeModel']
			})
		)
		docExtractor.grantInvoke(new AnyPrincipal())

		this.#bucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(docExtractor), {suffix: '.pdf'})

		this.#skillLambda = this.#buildLambda(this, 'alexa-skill', Duration.seconds(20), OutputFormat.CJS, {
			BUCKET_NAME: this.#bucket.bucketName
		})
		const skillLambdaPermissions = {
			principal: new ServicePrincipal('alexa-appkit.amazon.com'),
			action: 'lambda:InvokeFunction'
		}
		if (AMZN_SKILL_ID != null && AMZN_SKILL_ID != '') {
			// having this set at deploy time will cause a dependency cycle
			// so we allow for it to be set in a later update
			// I hate everything about this
			skillLambdaPermissions.eventSourceToken = AMZN_SKILL_ID
		}
		this.#skillLambda.addPermission('AlexaPermission', skillLambdaPermissions)
		this.#skillLambda.addToRolePolicy(
			new PolicyStatement({
				resources: ['*'],
				actions: ['bedrock:InvokeModel']
			})
		)

		this.#bucket.grantReadWrite(docExtractor)
		this.#bucket.grantReadWrite(this.#skillLambda)
		this.#bucket.addToResourcePolicy(
			new PolicyStatement({
				resources: [
					this.#bucket.arnForObjects('*') //"arn:aws:s3:::bucketname/*"
				],
				actions: ['s3:GetObject', 's3:PutObject'],
				principals: [docExtractor.grantPrincipal, this.#skillLambda.grantPrincipal]
			})
		)
	}

	deploySkill() {
		const skillAsset = new Asset(this, 'SkillPackageAsset', {
			path: join(__dirname, '../skill-package')
		})

		// Create a role so Alexa can read the asset from the CDK S3 bucket
		const skillAssetRole = new Role(this, 'AlexaSkillRole', {
			assumedBy: new ServicePrincipal('alexa-appkit.amazon.com')
		})
		skillAsset.grantRead(skillAssetRole)

		const skill = new CfnSkill(this, 'skill', {
			vendorId: ALEXA_VENDOR_ID,
			authenticationConfiguration: {
				clientId: ALEXA_CLIENT_ID,
				clientSecret: ALEXA_CLIENT_SECRET,
				refreshToken: ALEXA_REFRESH_TOKEN
			},
			skillPackage: {
				s3Bucket: skillAsset.s3BucketName,
				s3Key: skillAsset.s3ObjectKey,
				s3BucketRole: skillAssetRole.roleArn,
				overrides: {
					manifest: {
						apis: {
							custom: {
								endpoint: {
									uri: this.#skillLambda.functionArn
								}
							}
						}
					}
				}
			}
		})
		skill.node.addDependency(skillAssetRole)
	}

	deployCloudfront() {
		// 1. Get the password from Environment Variables
		const authPassword = process.env.UPLOAD_AUTH_PASSWORD
		if (!authPassword) {
			throw new Error('UPLOAD_AUTH_PASSWORD environment variable is required')
		}

		// 2. Read the function code and inject the password
		const rawCode = readFileSync(join(__dirname, '../src/cloudfront-auth.js'), 'utf8')
		const finalCode = rawCode.replace('%%AUTH_PASSWORD%%', authPassword)

		const authFunction = new Function(this, 'AuthHeaderFunction', {
			code: FunctionCode.fromInline(finalCode)
		})

		const distribution = new Distribution(this, 'UploadDistro', {
			defaultBehavior: {
				origin: S3BucketOrigin.withOriginAccessControl(this.#bucket),
				viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
				allowedMethods: AllowedMethods.ALLOW_ALL,
				functionAssociations: [
					{
						function: authFunction,
						eventType: FunctionEventType.VIEWER_REQUEST
					}
				]
			}
		})

		// Permissions
		this.#bucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:PutObject'],
				resources: [this.#bucket.arnForObjects('*')],
				principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
				conditions: {
					StringEquals: {
						'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
					}
				}
			})
		)

		new CfnOutput(this, 'uploadEndpoint', {value: `https://${distribution.domainName}`})
	}
}

export {DeployStack}
