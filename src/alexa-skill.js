import {getRequestType, getIntentName, getSlotValue, SkillBuilders} from 'ask-sdk-core'
import {QueryService} from './queryService.js'

const SIX_HOURS_IN_MILLIS = 6 * 60 * 60 * 1000
let queryService = null
let lastQueryServiceLoadTime = 0

//load on demand to ensure fresh info
async function loadQueryService() {
	if (queryService == null || lastQueryServiceLoadTime < Date.now() - SIX_HOURS_IN_MILLIS) {
		// most likely the lambda will have been recycled in under six hours, so it's unlikely we'll ever actually refresh the data within a lambda instance, but this is a reasonable backstop just in case.
		const newQueryService = new QueryService()
		await newQueryService.load()
		queryService = newQueryService
		lastQueryServiceLoadTime = Date.now()
	}
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
		if (date == null || typeof date !== 'string' || date.length == 0) {
			throw new Error(`'${data}' is not a valid date, expected ISO 8601 format (YYYY-MM-DD)`)
		}
		const speechOutput = await queryService.dateQuery(date)
		return handlerInput.responseBuilder.speak(speechOutput).withShouldEndSession(true).getResponse()
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
		if (eventName == null || typeof eventName !== 'string' || eventName.length == 0) {
			throw new Error(`No 'eventName' provided.`)
		}
		const speechOutput = await queryService.searchQuery(eventName)
		return handlerInput.responseBuilder.speak(speechOutput).withShouldEndSession(true).getResponse()
	}
}

const LaunchRequestHandler = {
	canHandle(handlerInput) {
		return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest'
	},
	handle(handlerInput) {
		const speakOutput =
			'Welcome to School Assistant. You can ask about events on a specific date or search for a specific event by name. How can I help?'
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
		console.log('handlerInput.requestEnvelope')
		console.log(handlerInput?.requestEnvelope)
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
