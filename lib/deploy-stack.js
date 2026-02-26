import {resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

import {Stack, Annotations, RemovalPolicy, Duration, CfnOutput} from 'aws-cdk-lib'
import {Bucket, BucketEncryption, EventType} from 'aws-cdk-lib/aws-s3'
import {PolicyStatement, AnyPrincipal} from 'aws-cdk-lib/aws-iam'
import {Runtime, FunctionUrlAuthType} from 'aws-cdk-lib/aws-lambda'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {LambdaDestination} from 'aws-cdk-lib/aws-s3-notifications'

const __dirname = dirname(fileURLToPath(import.meta.url))

class DeployStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		const bucket = new Bucket(this, 'files', {
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
			autoDeleteObjects: true
		})
		Annotations.of(bucket).acknowledgeWarning('@aws-cdk/aws-s3:accessLogsPolicyNotAdded')

		const docReceiver = this.#buildLambda(this, 'doc-receiver', 'doc-receiver', Duration.seconds(20), {
			BUCKET_NAME: bucket.bucketName
		})
		const functionUrl = docReceiver.addFunctionUrl({
			authType: FunctionUrlAuthType.NONE
		})
		docReceiver.grantInvoke(new AnyPrincipal())
		docReceiver.grantInvokeUrl(new AnyPrincipal())

		const docExtractor = this.#buildLambda(this, 'doc-extractor', 'doc-extractor', Duration.minutes(2))
		docExtractor.addToRolePolicy(
			new PolicyStatement({
				resources: ['*'],
				actions: ['bedrock:InvokeModel']
			})
		)
		docExtractor.grantInvoke(new AnyPrincipal())

		bucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(docExtractor), {suffix: '.pdf'})

		bucket.grantReadWrite(docReceiver)
		bucket.grantReadWrite(docExtractor)
		bucket.addToResourcePolicy(
			new PolicyStatement({
				resources: [
					bucket.arnForObjects('*') //"arn:aws:s3:::bucketname/*"
				],
				actions: ['s3:GetObject', 's3:PutObject'],
				principals: [docReceiver.grantPrincipal, docExtractor.grantPrincipal]
			})
		)

		new CfnOutput(this, 'docReceiverEndpoint', {value: functionUrl.url})
	}

	#buildLambda(stack, name, entry, timeout, envs = {}) {
		const handler = new NodejsFunction(stack, name, {
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
}

export {DeployStack}
