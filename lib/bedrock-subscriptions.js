import {Construct} from 'constructs'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from 'aws-cdk-lib/custom-resources'
import {Stack} from 'aws-cdk-lib'

export class BedrockModelEnabler extends Construct {
	constructor(scope, id, {modelIds}) {
		super(scope, id)

		modelIds.forEach(modelId => {
			const sanitizedId = modelId.replace(/[:.]/g, '-')

			// 1. Fetch Offer Token
			const listOffers = new AwsCustomResource(this, `ListOffers-${sanitizedId}`, {
				onCreate: {
					service: 'Bedrock',
					action: 'listFoundationModelAgreementOffers',
					parameters: {
						modelId,
						offerType: 'PUBLIC'
					},
					physicalResourceId: PhysicalResourceId.of(`offers-${modelId}`),
					outputPaths: ['offers.0.offerToken']
				},
				installLatestAwsSdk: true,
				policy: AwsCustomResourcePolicy.fromStatements([
					new PolicyStatement({
						actions: ['bedrock:ListFoundationModelAgreementOffers'],
						resources: ['*']
					})
				])
			})

			// 2. Create Agreement (The actual marketplace "handshake")
			const subscription = new AwsCustomResource(this, `Sub-${sanitizedId}`, {
				onCreate: {
					service: 'Bedrock',
					action: 'createFoundationModelAgreement',
					parameters: {
						modelId,
						offerToken: listOffers.getResponseField('offers.0.offerToken')
					},
					physicalResourceId: PhysicalResourceId.of(`agreement-${modelId}`),
					// Vital for idempotency
					ignoreErrorCodes: 'ConflictException'
				},
				installLatestAwsSdk: true,
				policy: AwsCustomResourcePolicy.fromStatements([
					new PolicyStatement({
						actions: [
							'bedrock:CreateFoundationModelAgreement',
							'aws-marketplace:Subscribe',
							'aws-marketplace:ViewSubscriptions'
						],
						resources: ['*']
					})
				])
			})

			subscription.node.addDependency(listOffers)
		})
	}

	arnsForModelIds(modelIds) {
		return modelIds.map(modelId => this.arnForModelId(modelId))
	}

	arnForModelId(modelId) {
		return Stack.of(this).formatArn({
			service: 'bedrock',
			account: '', // Foundation models are resource-level, no account ID
			resource: 'foundation-model',
			resourceName: modelId
		})
	}
}
