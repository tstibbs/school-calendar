import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'

// new Uint8Array(await readFile(path)) etc
async function parseDoc(pdfData) {
	const loadingTask = getDocument({data: pdfData.slice(), verbosity: 0})
	const pdf = await loadingTask.promise
	return pdf
}

export async function countPages(pdfData) {
	return (await parseDoc(pdfData)).numPages
}

export async function extractText(pdfData) {
	const pdf = await parseDoc(pdfData)

	let fullOutput = ''

	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i)
		const textContent = await page.getTextContent()

		const items = textContent.items.filter(item => item.str.trim().length > 0)

		// 1. Group items into lines (Binning)
		const lines = []
		items.forEach(item => {
			const y = item.transform[5]
			// Look for an existing line within a small Y-offset (e.g., 8-10 units)
			let line = lines.find(l => Math.abs(l.y - y) < 8)

			if (line) {
				line.items.push(item)
			} else {
				lines.push({y: y, items: [item]})
			}
		})

		// 2. Sort lines from Top to Bottom
		lines.sort((a, b) => b.y - a.y)

		let pageText = `--- Page ${i} ---\n`
		let lastY = -1

		for (const line of lines) {
			// 3. Sort items within the line from Left to Right
			line.items.sort((a, b) => a.transform[4] - b.transform[4])

			// Paragraph detection logic based on the gap between lines
			if (lastY !== -1) {
				const deltaY = Math.abs(lastY - line.y)
				if (deltaY > 20) {
					// Adjust this threshold for paragraph gaps
					pageText += '\n\n'
				} else {
					pageText += '\n'
				}
			}

			// Join items in the line with a space
			pageText += line.items.map(item => item.str).join(' ')
			lastY = line.y
		}

		fullOutput += pageText + '\n\n'
	}
	return cleanOrdinals(fullOutput)
}

const cleanOrdinals = text => {
	const months = 'January|February|March|April|May|June|July|August|September|October|November|December'
	const days = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday'

	/**
	 * We use two separate regex patterns for clarity:
	 * 1. Preceded by Day/Month: (?<=(?:Monday|...)\s+)(\d+)\s+(st|nd|rd|th)
	 * 2. Followed by (of) Month: (\d+)\s+(st|nd|rd|th)(?=\s+(?:of\s+)?(?:January|...))
	 */
	const pattern = new RegExp(
		`(?<=(?:${days}|${months})\\s+)(\\d+)\\s+(st|nd|rd|th)|(\\d+)\\s+(st|nd|rd|th)(?=\\s+(?:of\\s+)?(?:${months}))`,
		'gi'
	)

	return text.replace(pattern, (match, p1, p2, p3, p4) => {
		// p1, p2 are digits/suffix for the "preceded by" case
		// p3, p4 are digits/suffix for the "followed by" case
		const digits = p1 || p3
		const suffix = p2 || p4
		return `${digits}${suffix}`
	})
}
