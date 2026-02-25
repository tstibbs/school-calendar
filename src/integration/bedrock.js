import {BedrockRuntimeClient, ConverseCommand} from '@aws-sdk/client-bedrock-runtime'

import {INPUTS, PROMPTS, QUERY_CONFIG} from '../config.js'

const MAX_TOKENS = 2000

const client = new BedrockRuntimeClient()

export async function extractFromPdf(inputId, fileBody) {
	const {promptId} = INPUTS[inputId].extraction
	const {text, modelId} = PROMPTS[promptId]
	const conversation = [
		{
			role: 'user',
			content: [
				{
					document: {
						name: 'target_document',
						format: 'pdf',
						source: {
							bytes: fileBody
						}
					}
				},
				{
					text: text
				}
			]
		}
	]
	const outputText = await makeRequest(modelId, conversation)
	try {
		// check that it's valid json, but then return the string so it can be easily written back to S3
		JSON.parse(outputText)
		return outputText
	} catch (e) {
		console.error(e)
		console.error(`Response: '${outputText}'`)
		throw e
	}
}

export async function query(prompt) {
	const conversation = [
		{
			role: 'user',
			content: [
				{
					text: prompt
				}
			]
		}
	]
	return await makeRequest(QUERY_CONFIG.modelId, conversation)
}

async function makeRequest(modelId, conversation) {
	const command = new ConverseCommand({
		modelId: modelId,
		messages: conversation,
		inferenceConfig: {
			maxTokens: MAX_TOKENS
		}
	})

	const response = await client.send(command)
	const outputText = response.output.message.content[0].text
	return outputText
}
