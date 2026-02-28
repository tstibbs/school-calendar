import dotenv from 'dotenv'

dotenv.config()

const {handler} = await import('../src/alexa-skill.js')

function createIntentRequest(intentName, slots = {}) {
	const slotData = {}
	for (const [key, value] of Object.entries(slots)) {
		slotData[key] = {name: key, value: value}
	}

	return {
		version: '1.0',
		session: {
			new: true,
			application: {applicationId: 'amzn1.ask.skill.test-runner'}
		},
		request: {
			type: 'IntentRequest',
			requestId: 'amzn1.echo-api.request.test',
			timestamp: new Date().toISOString(),
			locale: 'en-UK',
			intent: {
				name: intentName,
				confirmationStatus: 'NONE',
				slots: slotData
			}
		}
	}
}

// Basic LaunchRequest payload
const launchRequest = {
	version: '1.0',
	session: {
		new: true,
		application: {applicationId: 'amzn1.ask.skill.test-runner'}
	},
	request: {
		type: 'LaunchRequest',
		requestId: 'amzn1.echo-api.request.test',
		timestamp: new Date().toISOString(),
		locale: 'en-UK'
	}
}

function invokeSkill(requestEnvelope) {
	return new Promise((resolve, reject) => {
		const dummyContext = {}

		// The lambda() wrapper expects (event, context, callback)
		handler(requestEnvelope, dummyContext, (error, response) => {
			if (error) {
				reject(error)
			} else {
				console.log(response?.response?.outputSpeech?.ssml)
				resolve()
			}
		})
	})
}

console.log('=== Testing LaunchRequest ===')
await invokeSkill(launchRequest)

console.log('\n=== Testing GetEventsByDateIntent ===')
const dateRequest = createIntentRequest('GetEventsByDateIntent', {eventDate: '2026-10-31'})
await invokeSkill(dateRequest)

console.log('\n=== Testing GetEventByNameIntent ===')
const nameRequest = createIntentRequest('GetEventByNameIntent', {eventName: 'disco'})
await invokeSkill(nameRequest)
