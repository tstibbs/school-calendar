import dotenv from 'dotenv'

dotenv.config()

const {BUCKET_NAME} = process.env

const {handler} = await import('../src/doc-extractor.js')

async function run(inputId) {
	await handler({
		Records: [
			{
				s3: {
					bucket: {
						name: BUCKET_NAME
					},
					object: {
						key: `${inputId}/input.pdf`
					}
				}
			}
		]
	})
}

await run('school1')
