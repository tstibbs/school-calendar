import {jest} from '@jest/globals'
jest.unstable_mockModule('../../src/config.js', () => ({
	INPUTS: {
		school1: {},
		school2: {}
	}
}))

import {DATA_FILE, EVENT_VIEW_FILE} from '../../src/database/dbConstants.js'
const {writeData} = await import('../../src/database/writer.js')

const INPUT_DATA = {
	//inputId to data
	school1: `[
		{ "startDate": "2026-06-01", "endDate": "2026-06-01", "description": "Parents Evening" },
		{ "startDate": "2026-06-12", "endDate": "2026-06-12", "description": "Founders Day Celebration" },
		{ "startDate": "2026-06-21", "endDate": "2026-07-02", "description": "Year 1 Assembly" }
	]`,
	school2: `[
		{ "startDate": "2026-06-06", "endDate": "2026-06-06", "description": "Disco" },
		{ "startDate": "2026-08-26", "endDate": "2026-09-03", "description": "Baking competition" }
	]`
}

test('single on', async () => {
	const outputData = {} //fileid to data
	const reader = async inputId => INPUT_DATA[inputId]
	const writer = async (fileId, content) => (outputData[fileId] = JSON.parse(content))
	await writeData(reader, writer)
	//pick a few values to check it's roughly like we expected
	expect(Object.values(outputData[DATA_FILE]).length).toEqual(5)
	expect(Object.values(outputData[DATA_FILE]).filter(event => event.inputId == 'school1').length).toEqual(3)
	expect(Object.values(outputData[DATA_FILE]).filter(event => event.inputId == 'school2').length).toEqual(2)
	expect(outputData[DATA_FILE]['school11'].startDate).toEqual('2026-06-01')
	expect(outputData[DATA_FILE]['school11'].endDate).toEqual('2026-06-01')
	expect(outputData[DATA_FILE]['school11'].description).toEqual('Parents Evening')
	expect(outputData[DATA_FILE]['school11'].eventId).toEqual('school11')
	expect(outputData[DATA_FILE]['school11'].inputId).toEqual('school1')
	expect(outputData[EVENT_VIEW_FILE]['school11']).toEqual('Parents Evening')
	expect(outputData[DATA_FILE]['school25'].startDate).toEqual('2026-08-26')
	expect(outputData[DATA_FILE]['school25'].endDate).toEqual('2026-09-03')
	expect(outputData[DATA_FILE]['school25'].description).toEqual('Baking competition')
	expect(outputData[DATA_FILE]['school25'].eventId).toEqual('school25')
	expect(outputData[DATA_FILE]['school25'].inputId).toEqual('school2')
	expect(outputData[EVENT_VIEW_FILE]['school25']).toEqual('Baking competition')
})
