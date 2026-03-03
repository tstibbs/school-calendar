import {resolve, dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {Stack, Annotations, RemovalPolicy, Duration, CfnOutput} from 'aws-cdk-lib'
import {Bucket, BucketEncryption, EventType} from 'aws-cdk-lib/aws-s3'
import {PolicyStatement, AnyPrincipal, ServicePrincipal, Role} from 'aws-cdk-lib/aws-iam'
import {Runtime, FunctionUrlAuthType} from 'aws-cdk-lib/aws-lambda'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {LambdaDestination} from 'aws-cdk-lib/aws-s3-notifications'
import {Asset} from 'aws-cdk-lib/aws-s3-assets'
import {CfnSkill} from 'aws-cdk-lib/alexa-ask'

import {
	AMZN_SKILL_ID,
	ALEXA_VENDOR_ID,
	ALEXA_CLIENT_ID,
	ALEXA_CLIENT_SECRET,
	ALEXA_REFRESH_TOKEN
} from './deploy-envs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

class DeployStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		const {skillLambda} = this.deployBackend()
		this.deploySkill(skillLambda)
	}

	#buildLambda(stack, entry, timeout, envs = {}) {
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
						return [`cp ${inputDir}/config-defaults.yaml ${outputDir}`, `cp ${inputDir}/config.yaml ${outputDir}`]
					}
				}
			}
		})
		return handler
	}

	deployBackend() {
		const bucket = new Bucket(this, 'files', {
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
			autoDeleteObjects: true
		})
		Annotations.of(bucket).acknowledgeWarning('@aws-cdk/aws-s3:accessLogsPolicyNotAdded')

		const docReceiver = this.#buildLambda(this, 'doc-receiver', Duration.seconds(20), {
			BUCKET_NAME: bucket.bucketName
		})
		const functionUrl = docReceiver.addFunctionUrl({
			authType: FunctionUrlAuthType.NONE
		})
		new CfnOutput(this, 'docReceiverEndpoint', {value: functionUrl.url})
		docReceiver.grantInvoke(new AnyPrincipal())
		docReceiver.grantInvokeUrl(new AnyPrincipal())

		const docExtractor = this.#buildLambda(this, 'doc-extractor', Duration.minutes(2))
		docExtractor.addToRolePolicy(
			new PolicyStatement({
				resources: ['*'],
				actions: ['bedrock:InvokeModel']
			})
		)
		docExtractor.grantInvoke(new AnyPrincipal())

		bucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(docExtractor), {suffix: '.pdf'})

		const skillLambda = this.#buildLambda(this, 'alexa-skill', Duration.seconds(20), {
			BUCKET_NAME: bucket.bucketName
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
		skillLambda.addPermission('AlexaPermission', skillLambdaPermissions)
		skillLambda.addToRolePolicy(
			new PolicyStatement({
				resources: ['*'],
				actions: ['bedrock:InvokeModel']
			})
		)

		bucket.grantReadWrite(docReceiver)
		bucket.grantReadWrite(docExtractor)
		bucket.grantReadWrite(skillLambda)
		bucket.addToResourcePolicy(
			new PolicyStatement({
				resources: [
					bucket.arnForObjects('*') //"arn:aws:s3:::bucketname/*"
				],
				actions: ['s3:GetObject', 's3:PutObject'],
				principals: [docReceiver.grantPrincipal, docExtractor.grantPrincipal, skillLambda.grantPrincipal]
			})
		)

		return {skillLambda}
	}

	deploySkill(skillLambda) {
		const skillAsset = new Asset(this, 'SkillPackageAsset', {
			path: join(__dirname, '../skill-package')
		})

		// Create a role so Alexa can read the asset from the CDK S3 bucket
		const skillAssetRole = new Role(this, 'AlexaSkillRole', {
			assumedBy: new ServicePrincipal('alexa-appkit.amazon.com')
		})
		skillAsset.grantRead(skillAssetRole)

		new CfnSkill(this, 'SchoolCalendar', {
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
									uri: skillLambda.functionArn
								}
							}
						}
					}
				}
			}
		})
	}
}

export {DeployStack}
