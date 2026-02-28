import {jest} from '@jest/globals'

jest.doMock('@aws-sdk/client-s3', () => ({
	S3Client: jest.fn(() => ({
		send: jest.fn()
	})),
	GetObjectCommand: jest.fn(input => ({input}))
}))

import {DATA_FILE, EVENT_VIEW_FILE} from '../../src/database/dbConstants.js'

const data = {
	input11: {
		startDate: '2025-06-07',
		endDate: '2025-06-07',
		eventId: 'input11',
		description: 'abc',
		inputId: 'input1'
	},
	input12: {
		startDate: '2025-06-03',
		endDate: '2025-06-10',
		eventId: 'input12',
		description: 'def',
		inputId: 'input1'
	},
	input13: {
		startDate: '2025-06-07',
		endDate: '2025-06-07',
		eventId: 'input13',
		description: 'abc2',
		inputId: 'input1'
	},
	input24: {
		startDate: '2025-12-01',
		endDate: '2025-12-01',
		eventId: 'input24',
		description: 'ghi',
		inputId: 'input2'
	}
}
const eventsById = {
	input11: 'abc',
	input12: 'def',
	input13: 'abc2',
	input24: 'ghi'
}

describe('Reader', () => {
	it('should read and process data from S3', async () => {
		const {Reader} = await import('../../src/database/reader.js')
		const {S3Client} = await import('@aws-sdk/client-s3')
		const s3Send = S3Client.mock.results[0].value.send

		const bucket = 'test-bucket'
		const reader = new Reader(bucket)

		s3Send.mockImplementation(command => {
			const key = command.input.Key
			if (key.endsWith(DATA_FILE)) {
				return Promise.resolve({
					Body: {
						transformToString: () => JSON.stringify(data)
					}
				})
			}
			if (key.endsWith(EVENT_VIEW_FILE)) {
				return Promise.resolve({
					Body: {
						transformToString: () => JSON.stringify(eventsById)
					}
				})
			}
			return Promise.reject(new Error(`Unexpected key: ${key}`))
		})

		await reader.load()

		//single event on date
		expect(reader.getEventsByDate('2025-12-01')).toBe('ghi')
		//multiple events on date
		expect(reader.getEventsByDate('2025-06-07')).toBe('abc, def, abc2')

		//single id matched
		expect(reader.getDatesByIds(['input11'])).toBe('abc on 2025-06-07')
		//multiple ids matched
		expect(reader.getDatesByIds(['input13', 'input24'])).toBe('abc2 on 2025-06-07, ghi on 2025-12-01')
		//date range
		expect(reader.getDatesByIds(['input12'])).toBe('def starting on 2025-06-03')

		const eventViewString = reader.getEventViewString()
		expect(eventViewString).toBe(JSON.stringify(eventsById))
	})
})
