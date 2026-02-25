import {readFileSync} from 'node:fs'
import YAML from 'yaml'

const configFileContents = readFileSync('config.yaml', 'utf8')
const config = YAML.parse(configFileContents)

export const INPUTS = config.inputs
export const QUERY_CONFIG = config.query
export const PROMPTS = config.prompts
