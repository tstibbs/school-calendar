import {S3Client, GetObjectCommand, PutObjectCommand} from '@aws-sdk/client-s3'
import {extractEventsFromPdf as aiPdfExtract, extractEventsFromText as aiTextExtract} from './integration/bedrock.js'
import {updateAllData} from './database/writer.js'
import {translateData} from './database/translate.js'
import {extractText as dumbPdfExtract, countPages} from './formats/pdf.js'
import {CONFIG} from './config.js'

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
	const pageCount = await countPages(fileBody)
	let output
	if (pageCount > CONFIG.pageLimitForAi) {
		// pages cost around $0.01 per page in claude sonnet, so cost can add up quickly
		console.log(`High page count (${pageCount}), so falling back to local text extract followed by AI text parsing`)
		const pageText = await dumbPdfExtract(fileBody)
		output = await aiTextExtract(inputId, pageText)
	} else {
		console.log(`Low page count (${pageCount}), using full AI pdf parsing`)
		output = await aiPdfExtract(inputId, fileBody)
	}
	const data = translateData(output)

	console.log(output)
	console.log(JSON.stringify(data))

	//write this input's data
	await s3Client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: `${inputId}/data.json`,
			Body: JSON.stringify(data),
			ContentType: 'application/json'
		})
	)
	//now update all data
	await updateAllData(bucket)
}
