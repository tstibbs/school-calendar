import {S3Client, GetObjectCommand} from '@aws-sdk/client-s3'
import {DATA_FILE, EVENT_VIEW_FILE, ALL_DATA_DIRECTORY} from './dbConstants.js'

const s3Client = new S3Client()

export class Reader {
	#bucket
	#data // { inputId: [{startDate, endDate, eventId, event}, ...] }
	#eventViewString

	constructor(bucket) {
		this.#bucket = bucket
	}

	async load() {
		const dataString = await this.#readFromS3(DATA_FILE)
		this.#data = JSON.parse(dataString)
		this.#eventViewString = await this.#readFromS3(EVENT_VIEW_FILE)
	}

	async #readFromS3(fileName) {
		const response = await s3Client.send(
			new GetObjectCommand({Bucket: this.#bucket, Key: `${ALL_DATA_DIRECTORY}/${fileName}`})
		)
		return response.Body.transformToString()
	}

	getEventsByDate(date) {
		const searchDate = new Date(date)
		const eventsOnDate = Object.values(this.#data)
			.filter(event => {
				const startDate = new Date(event.startDate)
				const endDate = new Date(event.endDate)
				return searchDate >= startDate && searchDate <= endDate
			})
			.map(event => event.description)

		return eventsOnDate.join(', ')
	}

	getDatesByIds(ids) {
		const dateStrings = ids
			.map(id => {
				const event = this.#data[id]
				if (!event) {
					return null
				}
				if (event.startDate === event.endDate) {
					return `${event.description} on ${event.startDate}`
				}
				return `${event.description} starting on ${event.startDate}`
			})
			.filter(Boolean)

		return dateStrings.join(', ')
	}

	getEventViewString() {
		return this.#eventViewString
	}
}
