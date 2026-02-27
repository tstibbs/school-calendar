import dotenv from 'dotenv'

dotenv.config()

const {BUCKET_NAME} = process.env

const {updateAllData} = await import('../src/database/writer.js')

await updateAllData(BUCKET_NAME)
