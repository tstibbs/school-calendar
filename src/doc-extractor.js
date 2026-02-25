import {S3Client, GetObjectCommand, PutObjectCommand} from '@aws-sdk/client-s3'
import {extractFromPdf} from './integration/bedrock.js'

const s3Client = new S3Client()

export const handler = async event => {
	const results = event.Records.map(async record => {
		const bucket = record.s3.bucket.name
		const key = decodeURIComponent(record.s3.object.key)

		try {
			await processOneObject(bucket, key)
			console.log(`Successfully processed ${key}`)
		} catch (err) {
			console.error(`Error processing ${key}:`, err)
			throw err
		}
	})
	await Promise.all(results)
}

async function processOneObject(bucket, key) {
	console.log(`Processing file: s3://${bucket}/${key}`)
	const keyParts = key.split('/')
	if (keyParts.length != 2) {
		throw new Error(`Invalid key: ${key}`)
	}
	if (keyParts[1] != 'input.pdf') {
		return
	}
	const inputId = keyParts[0]
	const response = await s3Client.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: key
		})
	)
	const fileBody = await response.Body.transformToByteArray()
	const output = await extractFromPdf(inputId, fileBody)
	await s3Client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: `${inputId}/data.json`,
			Body: output,
			ContentType: 'application/json'
		})
	)
}
