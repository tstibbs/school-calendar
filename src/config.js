import {readFileSync} from 'node:fs'
import {load} from 'js-yaml'
import {merge} from 'lodash-es'

const defaults = readFileSync('config-defaults.yaml', 'utf8')
const customs = readFileSync('config.yaml', 'utf8')
const defaultConfig = load(defaults)
const customConfig = load(customs)

const config = merge({}, defaultConfig, customConfig)

export const INPUTS = config.inputs
export const QUERY_CONFIG = config.query
export const PROMPTS = config.prompts
export const CONFIG = config.config
