import {jest} from '@jest/globals'
jest.unstable_mockModule('../../src/config.js', () => ({
	INPUTS: {
		school1: {},
		school2: {}
	}
}))

const {writeData, DATA_FILE, EVENT_VIEW_FILE} = await import('../../src/database/writer.js')

const INPUT_DATA = {
	//inputId to data
	school1: `[
		{ "startDate": "2026-06-01", "endDate": "2026-06-01", "event": "Parents Evening" },
		{ "startDate": "2026-06-12", "endDate": "2026-06-12", "event": "Founders Day Celebration" },
		{ "startDate": "2026-06-21", "endDate": "2026-07-02", "event": "Year 1 Assembly" }
	]`,
	school2: `[
		{ "startDate": "2026-06-06", "endDate": "2026-06-06", "event": "Disco" },
		{ "startDate": "2026-08-26", "endDate": "2026-09-03", "event": "Baking competition" }
	]`
}

test('single on', async () => {
	const outputData = {} //fileid to data
	const reader = async inputId => INPUT_DATA[inputId]
	const writer = async (fileId, content) => (outputData[fileId] = JSON.parse(content))
	await writeData(reader, writer)
	//pick a few values to check it's roughly like we expected
	expect(outputData[DATA_FILE]['school1'].length).toEqual(3)
	expect(outputData[DATA_FILE]['school2'].length).toEqual(2)
	expect(outputData[DATA_FILE]['school1'][0].startDate).toEqual('2026-06-01')
	expect(outputData[DATA_FILE]['school1'][0].endDate).toEqual('2026-06-01')
	expect(outputData[DATA_FILE]['school1'][0].event).toEqual('Parents Evening')
	expect(outputData[DATA_FILE]['school1'][0].eventId).toEqual('school11')
	expect(outputData[EVENT_VIEW_FILE]['school11']).toEqual('Parents Evening')
	expect(outputData[DATA_FILE]['school2'][1].startDate).toEqual('2026-08-26')
	expect(outputData[DATA_FILE]['school2'][1].endDate).toEqual('2026-09-03')
	expect(outputData[DATA_FILE]['school2'][1].event).toEqual('Baking competition')
	expect(outputData[DATA_FILE]['school2'][1].eventId).toEqual('school25')
	expect(outputData[EVENT_VIEW_FILE]['school25']).toEqual('Baking competition')
})
