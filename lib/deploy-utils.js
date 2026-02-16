import {App} from 'aws-cdk-lib'
import {DeployStack} from '../lib/deploy-stack.js'
import {STACK_NAME} from './deploy-envs.js'

export function buildStack() {
	const app = new App()
	return new DeployStack(app, STACK_NAME)
}
