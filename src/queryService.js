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
		const ids = await this.#queryBedrockForEventIds(userInput)
		return this.handleEventIds(ids)
	}

	async #queryBedrockForEventIds(userInput) {
		const data = await this.#reader.getEventViewString()
		const prompt = QUERY_CONFIG.text.replaceAll('${data}', data).replaceAll('${userInput}', userInput)
		const response = await query(prompt)
		console.log(`Response: ${response}`)
		try {
			return [...JSON.parse(response)]
		} catch (e) {
			console.error("Bedrock response wasn't json:")
			console.error(response)
			throw e
		}
	}

	//function non-private to make it easier to test without calling bedrock
	handleEventIds(ids) {
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
						const singleDates = events.filter(e => e.startDate == e.endDate).map(e => formatDateForSpeech(e.startDate))
						const dateRanges = events
							.filter(e => e.startDate != e.endDate)
							.map(e => `starting ${formatDateForSpeech(e.startDate)}`)
						const dates = [...singleDates, ...dateRanges].join(', ')
						const joiner = singleDates.length == 0 ? 'on ' : ''
						return `${description} ${joiner}${dates} at ${inputId}`
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
			return `I can't find any events on ${formatDateForSpeech(date)}`
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

function formatDateForSpeech(dateAsString) {
	const date = new Date(dateAsString) //TODO this might be off by a day in DST?
	const day = date.getDate()
	const month = date.toLocaleString('en-GB', {month: 'long'})
	const getSuffix = d => {
		if (d == 11 || d == 12 || d == 13) {
			//why must the english language be so stupid!?
			return 'th'
		}
		switch (d % 10) {
			case 1:
				return 'st'
			case 2:
				return 'nd'
			case 3:
				return 'rd'
			default:
				return 'th'
		}
	}
	return `${day}${getSuffix(day)} of ${month}`
}
