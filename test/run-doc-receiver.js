import path from 'path'
import fs from 'fs/promises'
import dotenv from 'dotenv'

dotenv.config()

const {handler} = await import('../src/doc-receiver.js')

async function run(inputId, filePath) {
	const fullFilePath = path.resolve(filePath)
	const fileBuffer = await fs.readFile(fullFilePath)
	const base64 = fileBuffer.toString('base64')
	const request = {
		requestContext: {
			http: {
				method: 'PUT',
				path: `/${inputId}`
			}
		},
		body: base64,
		isBase64Encoded: true
	}
	await handler(request)
}

await run('school1', 'input1.pdf')
