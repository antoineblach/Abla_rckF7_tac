// Build of the application (plan of lot 2, section 10): jsPDF and gifenc only in the chunk of the
// export worker, and none of the optional dependencies of jsPDF (D-071). Reads dist/, built by the
// web server of the tests.
import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('keeps the encoders in the worker chunk, without the optional dependencies of jsPDF', () => {
  const dir = 'dist/assets'
  const scripts = readdirSync(dir).filter((name) => name.endsWith('.js'))
  const main = scripts.filter((name) => name.startsWith('index-'))
  const worker = scripts.filter((name) => name.startsWith('exportWorker-'))
  expect(main).toHaveLength(1)
  expect(worker).toHaveLength(1)
  const read = (name: string) => readFileSync(`${dir}/${name}`, 'utf8')
  const mainCode = read(main[0] ?? '')
  const workerCode = read(worker[0] ?? '')
  // gifenc writes the NETSCAPE2.0 loop block; jsPDF names its context « jsPDF ».
  expect(workerCode).toContain('NETSCAPE2.0')
  expect(workerCode).toContain('jsPDF')
  expect(mainCode).not.toContain('NETSCAPE2.0')
  expect(mainCode).not.toContain('jsPDF')
  // Every other chunk is the empty module standing for html2canvas, dompurify and canvg.
  for (const name of scripts.filter((n) => !main.includes(n) && !worker.includes(n))) {
    expect(name).toMatch(/^emptyModule-/)
  }
})
