import dotenv from 'dotenv'

dotenv.config()
let {APP_ID, STACK_NAME} = process.env
if (STACK_NAME == null || STACK_NAME.length == 0) {
	STACK_NAME = 'Default'
}
export {APP_ID, STACK_NAME}
