import {Stack, Annotations, RemovalPolicy} from 'aws-cdk-lib'

import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'

class DeployStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		const bucket = new Bucket(this, 'files', {
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
			autoDeleteObjects: true
		})
		Annotations.of(bucket).acknowledgeWarning('@aws-cdk/aws-s3:accessLogsPolicyNotAdded')
	}
}

export {DeployStack}
