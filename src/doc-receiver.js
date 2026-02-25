import {createHash} from 'node:crypto'

import {S3Client, PutObjectCommand, HeadObjectCommand} from '@aws-sdk/client-s3'

import {INPUTS} from './config.js'

const s3Client = new S3Client()
const BUCKET_NAME = process.env.BUCKET_NAME

export async function handler(event) {
	try {
		console.log(event)
		await processRequest(event)
		return {
			statusCode: 200
		}
	} catch (error) {
		const statusCode = error.statusCode || 500
		return {statusCode, body: error.message}
	}
}

async function processRequest(event) {
	const method = event?.requestContext?.http?.method

	if (method != 'PUT') {
		const error = new Error(`Method Not Allowed: ${method}`)
		error.statusCode = 405
		throw error
	}

	const path = event?.requestContext?.http?.path
	const inputId = path.startsWith('/') ? path.substring(1) : path

	let {body, isBase64Encoded} = event
	if (isBase64Encoded) {
		body = Buffer.from(body, 'base64')
	}
	await processFile(inputId, body)
}

async function processFile(inputName, fileBuffer) {
	if (!(inputName in INPUTS)) {
		const error = new Error(`Unknown input name: ${inputName}`)
		error.statusCode = 404
		throw error
	}
	const key = `${inputName}/input.pdf`
	const incomingHash = createHash('md5').update(fileBuffer).digest('hex')

	let shouldUpload = false

	let headResponse
	try {
		console.log(`head: ${BUCKET_NAME}, ${key}`)
		headResponse = await s3Client.send(
			new HeadObjectCommand({
				Bucket: BUCKET_NAME,
				Key: key
			})
		)
		console.log('found in s3')

		// S3 ETag is the MD5 hash of the object content (for objects < 5GB)
		const existingETag = headResponse.ETag.replace(/"/g, '')

		if (incomingHash !== existingETag) {
			shouldUpload = true
			console.log(`${incomingHash} !== ${existingETag}`)
		} else {
			console.log(`${incomingHash} === ${existingETag}`)
		}
	} catch (err) {
		if (err.name === 'NotFound') {
			console.log('not found in s3')
			shouldUpload = true
		} else {
			throw err
		}
	}

	if (shouldUpload) {
		console.log(`uploading: ${key}`)
		await s3Client.send(
			new PutObjectCommand({
				Bucket: BUCKET_NAME,
				Key: key,
				Body: fileBuffer,
				ContentType: 'application/pdf'
			})
		)
		console.log(`uploaded: ${key}`)
	}
}
