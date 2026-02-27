/* Building a database using a series of json files is probably not a good idea */

import {INPUTS} from '../config.js'
import {S3Client, GetObjectCommand, PutObjectCommand} from '@aws-sdk/client-s3'

export const DATA_FILE = 'data.json'
export const EVENT_VIEW_FILE = 'event_view.json'

const s3Client = new S3Client()

export async function updateAllData(bucket) {
	const reader = async inputId => {
		const response = await s3Client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: `${inputId}/${DATA_FILE}`
			})
		)
		return response.Body.transformToString()
	}
	const writer = async (fileId, content) => {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: `allData/${fileId}`,
				Body: content,
				ContentType: 'application/json'
			})
		)
	}
	await writeData(reader, writer)
}

export async function writeData(reader, writer) {
	const dataPromises = Object.keys(INPUTS).map(async inputId => {
		const jsonString = await reader(inputId)
		try {
			const json = JSON.parse(jsonString)
			return [inputId, json]
		} catch (e) {
			console.error(jsonString)
			throw e
		}
	})
	const data = Object.fromEntries(await Promise.all(dataPromises))
	const dataCount = Object.values(data).flat().length
	const padSize = Math.ceil(Math.log10(dataCount + 1))

	let eventCount = 0
	//edit in place to add event ids
	Object.entries(data).forEach(([inputId, inputData]) => {
		inputData.forEach(obj => {
			eventCount++
			const id = String(eventCount).padStart(padSize, '0')
			obj.eventId = `${inputId}${id}`
		})
	})
	const idToEvent = Object.fromEntries(
		Object.values(data)
			.flat()
			.map(({eventId, event}) => [eventId, event])
	)
	await writer(DATA_FILE, JSON.stringify(data))
	await writer(EVENT_VIEW_FILE, JSON.stringify(idToEvent))
}
