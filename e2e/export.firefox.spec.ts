// Exports in degraded mode (Firefox, no folder): the worker, OffscreenCanvas and the font work in
// Firefox; the files are downloaded (SPEC 8.6, 9.1).
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { buildScenario, save } from './support/editorActions'
import { closeResult, exportFromToolbar, exportResult, readGif, readPdf } from './support/exports'

test('downloads a valid GIF and a valid PDF', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  await page.goto('./')
  await buildScenario(page, 'Croisée test')
  await save(page)

  const gifDownload = page.waitForEvent('download', { timeout: 90_000 })
  await exportFromToolbar(page, 'Exporter GIF', async (dialog) => {
    await dialog.getByLabel('Vitesse').selectOption('real')
  })
  const gifFile = await gifDownload
  expect(gifFile.suggestedFilename()).toBe('croisee-test--portrait-enchaine-reel.gif')
  const gifPath = testInfo.outputPath(gifFile.suggestedFilename())
  await gifFile.saveAs(gifPath)
  const gif = readGif(readFileSync(gifPath))
  expect([gif.width, gif.height]).toEqual([540, 960])
  expect(gif.frames).toBeGreaterThan(20)
  const result = await exportResult(page)
  expect(result.names).toEqual(['croisee-test--portrait-enchaine-reel.gif'])
  await expect(page.getByTestId('export-result')).toContainText('Téléchargé')
  await closeResult(page)

  const pdfDownload = page.waitForEvent('download', { timeout: 60_000 })
  await exportFromToolbar(page, 'Exporter PDF')
  const pdfFile = await pdfDownload
  expect(pdfFile.suggestedFilename()).toBe('croisee-test--impression.pdf')
  const pdfPath = testInfo.outputPath(pdfFile.suggestedFilename())
  await pdfFile.saveAs(pdfPath)
  const pdf = await readPdf(readFileSync(pdfPath))
  expect(pdf.texts[0]).toContain('Croisée test')
  expect(pdf.texts[0]).toContain('Option B : Défense montée')
})
