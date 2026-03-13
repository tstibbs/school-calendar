import {readFile} from 'node:fs/promises'

import {extractText} from '../src/formats/pdf.js'

const path = './input.pdf'
const pageText = await extractText(new Uint8Array(await readFile(path)))
console.log(pageText)
