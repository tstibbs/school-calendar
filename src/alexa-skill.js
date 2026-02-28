import {getRequestType, getIntentName, getSlotValue, SkillBuilders} from 'ask-sdk-core'
import {QueryService} from './queryService.js'

//load on demand to ensure fresh info
async function loadQueryService() {
	const queryService = new QueryService()
	await queryService.load()
	return queryService
}

/**
 * Handler for the GetEventsByDateIntent
 * Triggered by: "What is happening on {eventDate}"
 */
const GetEventsByDateIntentHandler = {
	canHandle(handlerInput) {
		return (
			getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
			getIntentName(handlerInput.requestEnvelope) === 'GetEventsByDateIntent'
		)
	},
	async handle(handlerInput) {
		const queryService = await loadQueryService()
		const date = getSlotValue(handlerInput.requestEnvelope, 'eventDate')
		const speechOutput = await queryService.dateQuery(date)
		return handlerInput.responseBuilder
			.speak(speechOutput)
			.reprompt('Is there anything else I can help you find?')
			.getResponse()
	}
}

/**
 * Handler for the GetEventByNameIntent
 * Triggered by: "When is the {eventName}"
 */
const GetEventByNameIntentHandler = {
	canHandle(handlerInput) {
		return (
			getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
			getIntentName(handlerInput.requestEnvelope) === 'GetEventByNameIntent'
		)
	},
	async handle(handlerInput) {
		const queryService = await loadQueryService()
		const eventName = getSlotValue(handlerInput.requestEnvelope, 'eventName')
		const speechOutput = await queryService.searchQuery(eventName)
		return handlerInput.responseBuilder
			.speak(speechOutput)
			.reprompt('Would you like to check another event?')
			.getResponse()
	}
}

const LaunchRequestHandler = {
	canHandle(handlerInput) {
		return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest'
	},
	handle(handlerInput) {
		const speakOutput =
			'Welcome to school Calendar. You can ask about events on a specific date or search for a specific event by name. How can I help?'
		return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse()
	}
}

const HelpIntentHandler = {
	canHandle(handlerInput) {
		return (
			getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
			getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
		)
	},
	handle(handlerInput) {
		const speakOutput = 'You can say "what is happening tomorrow" or "when is the disco". How can I help?'
		return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse()
	}
}

const CancelAndStopIntentHandler = {
	canHandle(handlerInput) {
		return (
			getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
			(getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
				getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent')
		)
	},
	handle(handlerInput) {
		return handlerInput.responseBuilder.speak('Goodbye!').getResponse()
	}
}

const ErrorHandler = {
	canHandle() {
		return true
	},
	handle(handlerInput, error) {
		console.log(`Error handled:`)
		console.log(error)
		const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.'
		return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse()
	}
}

export const handler = SkillBuilders.custom()
	.addRequestHandlers(
		LaunchRequestHandler,
		GetEventsByDateIntentHandler,
		GetEventByNameIntentHandler,
		HelpIntentHandler,
		CancelAndStopIntentHandler
	)
	.addErrorHandlers(ErrorHandler)
	.lambda()
