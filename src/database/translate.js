export function translateData(stringOutput) {
	const data = JSON.parse(stringOutput)
	if (!data.every(event => goodDate(event.start_date) && goodDate(event.end_date) && goodString(event.event))) {
		console.error(stringOutput)
		throw new Error('Invalid data')
	}
	const dateData = data.map((event, index) => ({
		startDate: parseDate(event.start_date),
		endDate: parseDate(event.end_date),
		description: event.event
	}))
	return dateData
}

const goodDate = str => goodString(str) && /\d{1,2}-\d{1,2}/.test(str)

const goodString = str => str != null && typeof str === 'string' && str.length > 0

const parseDate = str => {
	const dateNow = new Date()
	dateNow.setDate(dateNow.getDate() - 14)
	const timeNow = dateNow.getTime() // actually time two week's ago, to prevent slight parsing delays pushing things into next year unnecessarily
	const yearNow = new Date().getFullYear()
	let fullDate = new Date(yearNow + '-' + str)
	if (fullDate.getTime() < timeNow) {
		fullDate.setFullYear(yearNow + 1)
	}
	const fullDateString = fullDate.toISOString().split('T')[0]
	return fullDateString
}
