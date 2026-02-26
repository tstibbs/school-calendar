import {readFileSync} from 'node:fs'
import YAML from 'yaml'
import {merge} from 'lodash-es'

const defaults = readFileSync('config-defaults.yaml', 'utf8')
const customs = readFileSync('config.yaml', 'utf8')
const defaultConfig = YAML.parse(defaults)
const customConfig = YAML.parse(customs)

const config = merge({}, defaultConfig, customConfig)

export const INPUTS = config.inputs
export const QUERY_CONFIG = config.query
export const PROMPTS = config.prompts
