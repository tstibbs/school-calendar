import {BedrockRuntimeClient, ConverseCommand} from '@aws-sdk/client-bedrock-runtime'

import {INPUTS, QUERY_CONFIG} from '../config.js'

const MAX_TOKENS = 2000

const client = new BedrockRuntimeClient()

export async function extractFromPdf(inputId, fileBuffer) {
	const {prompt, modelId} = INPUTS[inputId].extraction
	const conversation = [
		{
			role: 'user',
			content: [
				{
					document: {
						name: 'target_document',
						format: 'pdf',
						source: {
							bytes: fileBuffer
						}
					}
				},
				{
					text: prompt
				}
			]
		}
	]
	const outputText = await makeRequest(conversation)
	try {
		const data = JSON.parse(outputText)
		return data
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
	return await makeRequest(conversation)
}

async function makeRequest(conversation) {
	const command = new ConverseCommand({
		modelId: QUERY_CONFIG.modelId,
		messages: conversation,
		inferenceConfig: {
			maxTokens: MAX_TOKENS
		}
	})

	const response = await client.send(command)
	const outputText = response.output.message.content[0].text
	return outputText
}
