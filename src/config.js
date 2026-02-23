import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import YAML from 'yaml'

const configFileContents = await readFile(join(process.cwd(), 'config.yaml'), 'utf8')
const config = YAML.parse(configFileContents)

export const INPUTS = config.inputs
export const QUERY_CONFIG = config.query
