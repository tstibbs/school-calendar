import {query} from './integration/bedrock.js'
import {Reader} from './database/reader.js'
import {QUERY_CONFIG} from './config.js'

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
			ids.push.apply(JSON.parse(response))
		} catch (e) {
			console.error("Bedrock response wasn't json:")
			console.error(response)
			throw e
		}
		if (ids.length == 0) {
			return `No events matching that description`
		} else {
			return this.#reader.getDatesByIds(ids)
		}
	}

	async dateQuery(date) {
		// Alexa typically provides dates in ISO 8601 format (YYYY-MM-DD).
		return this.#reader.getEventsByDate(date)
	}
}
