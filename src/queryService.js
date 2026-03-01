import {query} from './integration/bedrock.js'
import {Reader} from './database/reader.js'
import {QUERY_CONFIG} from './config.js'

const listFormatter = new Intl.ListFormat('en', {style: 'long', type: 'conjunction'})

export class QueryService {
	#reader

	constructor() {
		this.#reader = new Reader(process.env.BUCKET_NAME)
	}

	async load() {
		await this.#reader.load()
	}

	async searchQuery(userInput) {
		const data = await this.#reader.getEventViewString()
		const prompt = QUERY_CONFIG.text.replaceAll('${data}', data).replaceAll('${userInput}', userInput)
		const response = await query(prompt)
		console.log(`Response: ${response}`)
		const ids = []
		try {
			ids.push(...JSON.parse(response))
		} catch (e) {
			console.error("Bedrock response wasn't json:")
			console.error(response)
			throw e
		}
		if (ids.length == 0) {
			return `No events matching that description`
		} else {
			const events = this.#reader.getDatesByIds(ids)
			const groupedData = events.reduce((acc, event) => {
				const {inputId, description} = event
				if (!acc[inputId]) {
					acc[inputId] = {}
				}
				if (!acc[inputId][description]) {
					acc[inputId][description] = []
				}
				acc[inputId][description].push(event)
				return acc
			}, {})
			const summaries = Object.entries(groupedData)
				.flatMap(([inputId, descriptions]) => {
					return Object.entries(descriptions).map(([description, events]) => {
						const dates = events
							.map(e => (e.startDate === e.endDate ? e.startDate : `starting ${e.startDate}`))
							.join(', ')
						return `${description} on ${dates} at ${inputId}`
					})
				})
				.join('. ')
			console.log(summaries)
			return summaries
		}
	}

	async dateQuery(date) {
		// Alexa typically provides dates in ISO 8601 format (YYYY-MM-DD).
		const eventsOnDate = this.#reader.getEventsByDate(date)
		if (eventsOnDate.length == 0) {
			return `I can't find any events on ${date}`
		} else {
			const groupedData = eventsOnDate.reduce((acc, event) => {
				const {inputId, description} = event
				if (!acc[inputId]) {
					acc[inputId] = {}
				}
				//de-dupe on description
				acc[inputId][description] = event
				return acc
			}, {})
			const descriptions = Object.entries(groupedData)
				.flatMap(([inputId, descriptions]) => {
					const descriptionText = listFormatter.format(Object.keys(descriptions))
					return `${descriptionText} at ${inputId}`
				})
				.join('. ')
			return descriptions
		}
	}
}
