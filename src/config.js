import {readFileSync} from 'node:fs'
import {load} from 'js-yaml'
import {merge} from 'lodash-es'

function loadConfig() {
	const defaults = readFileSync('config-defaults.yaml', 'utf8')
	const customs = readFileSync('config.yaml', 'utf8')
	const defaultConfig = load(defaults)
	const customConfig = load(customs)

	const config = merge({}, defaultConfig, customConfig)
	validateConfig(config)
	return config
}

function validateConfig(config) {
	if (Object.keys(config.inputs).length == 0) {
		throw new Error(
			`No inputs specified configured - create/update config.yaml, use config-example.yaml as a reference`
		)
	}
	//this regex must match the regex in cloudfront-auth.js
	const nonMatches = Object.keys(config.inputs).filter(input => !/^[\w-_]+$/.test(input))
	if (nonMatches.length > 0) {
		throw new Error(`The following input names are in an invalid format: ${nonMatches.join(', ')}`)
	}
	const undefinedPrompts = Object.values(config.inputs)
		.map(input => input.extraction.promptId)
		.filter(promptId => !(promptId in config.prompts))
	if (undefinedPrompts.length > 0) {
		throw new Error(`The following promptIds were referenced but not defined: ${undefinedPrompts.join(', ')}`)
	}
}

export const config = loadConfig()
export const INPUTS = config.inputs
export const QUERY_CONFIG = config.query
export const PROMPTS = config.prompts
export const CONFIG = config.config
