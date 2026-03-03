import dotenv from 'dotenv'

dotenv.config()
export const {STACK_NAME, AMZN_SKILL_ID, ALEXA_VENDOR_ID, ALEXA_CLIENT_ID, ALEXA_CLIENT_SECRET, ALEXA_REFRESH_TOKEN} =
	process.env
