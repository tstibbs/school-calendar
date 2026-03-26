import {createHash} from 'node:crypto'

import {S3Client, GetObjectCommand, PutObjectCommand} from '@aws-sdk/client-s3'
import {buildErrorNotifyingLambdaHandler} from '@tstibbs/cloud-core-utils/src/utils/lambda.js'

import {extractEventsFromPdf as aiPdfExtract, extractEventsFromText as aiTextExtract} from './integration/bedrock.js'
import {updateAllData} from './database/writer.js'
import {translateData} from './database/translate.js'
import {extractText as dumbPdfExtract, countPages} from './formats/pdf.js'
import {CONFIG} from './config.js'

const s3Client = new S3Client()

async function handleEvent(event) {
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

	// Calculate hash of incoming file
	const incomingHash = createHash('md5').update(fileBody).digest('hex')
	const hashKey = `${inputId}/input.pdf.hash`

	// Check if hash has changed
	const hasChanged = await hashHasChanged(bucket, hashKey, incomingHash)

	if (!hasChanged) {
		console.log(`File hash unchanged for ${inputId}, skipping extraction`)
		return
	}

	console.log(`File hash changed for ${inputId}, proceeding with extraction`)
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

	// Store the hash for future comparisons
	await s3Client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: hashKey,
			Body: incomingHash,
			ContentType: 'text/plain'
		})
	)

	//now update all data
	await updateAllData(bucket)
}

async function hashHasChanged(bucket, hashKey, incomingHash) {
	try {
		const response = await s3Client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: hashKey
			})
		)
		const storedHash = await response.Body.transformToString()

		if (incomingHash === storedHash) {
			console.log(`Hash unchanged: ${incomingHash} == ${storedHash}`)
			return false
		} else {
			console.log(`Hash changed: ${incomingHash} !== ${storedHash}`)
			return true
		}
	} catch (err) {
		if (err.name === 'NoSuchKey') {
			console.log(`No stored hash found for ${hashKey}, treating as changed`)
			return true
		} else {
			throw err
		}
	}
}

export const handler = buildErrorNotifyingLambdaHandler('doc-extractor', handleEvent)
