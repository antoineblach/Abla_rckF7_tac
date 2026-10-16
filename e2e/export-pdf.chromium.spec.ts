// PDF exports in folder mode, through the real export worker (SPEC 9.3, D-062 to D-064).
import { expect, test } from '@playwright/test'
import { buildScenario, save } from './support/editorActions'
import { closeResult, exportFromToolbar, exportResult, readPdf } from './support/exports'
import { stubFolderPicker } from './support/folderStub'
import { readFolderBytes } from './support/opfs'

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000)
  await stubFolderPicker(page)
  await page.goto('./')
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
})

test('exports the PDF of a play, in black and white for print and in colour for the phone', async ({
  page,
}) => {
  await buildScenario(page, 'Croisée test')
  await save(page)
  await exportFromToolbar(page, 'Exporter PDF', async (dialog) => {
    await dialog.getByLabel('Couleurs').selectOption('bw')
  })
  const print = await exportResult(page)
  expect(print.names).toEqual(['croisee-test--impression-nb.pdf'])
  await closeResult(page)
  const printPdf = await readPdf(
    await readFolderBytes(page, 'exports/croisee-test--impression-nb.pdf'),
  )
  expect(printPdf.pages).toBe(1)
  expect(printPdf.firstPageMm[0]).toBeCloseTo(297, 0)
  expect(printPdf.firstPageMm[1]).toBeCloseTo(210, 0)
  for (const text of [
    'Croisée test',
    'Option B : Défense montée',
    'Temps 3, option A',
    'Retour intérieur',
  ]) {
    expect(printPdf.texts[0]).toContain(text)
  }

  await exportFromToolbar(page, 'Exporter PDF', async (dialog) => {
    await dialog.getByLabel('Mise en page').selectOption('phone')
    await dialog.getByLabel('Couleurs').selectOption('color')
  })
  const phone = await exportResult(page)
  expect(phone.names).toEqual(['croisee-test--telephone.pdf'])
  const phonePdf = await readPdf(await readFolderBytes(page, 'exports/croisee-test--telephone.pdf'))
  expect(phonePdf.firstPageMm[0]).toBeCloseTo(100, 0)
  expect(phonePdf.texts[0]).toContain('Option A : Défense en retrait')
})

test('makes a playbook of five imported plays: contents, links and bookmarks (D-064)', async ({
  page,
}) => {
  await page.getByTestId('import-input').setInputFiles('e2e/fixtures/cahier.combipack.json')
  await expect(page.getByRole('button', { name: /^Ouvrir / })).toHaveCount(5)
  await page.getByRole('button', { name: 'Cahier de jeu' }).click()
  const dialog = page.getByTestId('book-dialog')
  await expect(dialog.getByRole('checkbox')).toHaveCount(5)
  await dialog.getByRole('button', { name: 'Exporter le cahier' }).click()
  const result = await exportResult(page)
  expect(result.names).toEqual(['cahier-de-jeu--cahier-impression.pdf'])
  const pdf = await readPdf(
    await readFolderBytes(page, 'exports/cahier-de-jeu--cahier-impression.pdf'),
  )

  expect(pdf.texts[0]).toContain('Cahier de jeu')
  expect(pdf.texts[0]).toContain('Sélection')
  expect(pdf.texts[0]).toContain('5 combinaisons')
  expect(pdf.texts[1]).toContain('Sommaire')
  const destinations = pdf.links[1] ?? []
  expect(destinations).toHaveLength(5)
  expect(pdf.outline.map((o) => o.page)).toEqual(destinations)
  expect(new Set(pdf.outline.map((o) => o.title))).toEqual(
    new Set([
      'Croisée au centre',
      'Trois options « au large »',
      'Double option',
      'Atelier 4 contre 2',
      'Croisée côté fermé',
    ]),
  )
  // Every play starts on the page its contents entry gives, after the title page and contents.
  for (const entry of pdf.outline) {
    expect(entry.page).not.toBeNull()
    expect(pdf.texts[(entry.page ?? 0) - 1]).toContain(entry.title)
    expect(pdf.texts[1]).toContain(String(entry.page))
  }
  expect(Math.min(...destinations.map((d) => d ?? 0))).toBe(3)
  expect(pdf.pages).toBeGreaterThanOrEqual(2 + 5)
  // The play with three options: its third option is in the PDF.
  expect(pdf.texts.join(' ')).toContain('Option C : Défense glissée')
})
