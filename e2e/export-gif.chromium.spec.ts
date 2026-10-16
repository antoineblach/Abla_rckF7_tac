// GIF exports in folder mode, through the real export worker (SPEC 9.1, 9.2, D-065).
import { expect, test, type Page } from '@playwright/test'
import { createCaches } from '../src/engine/caches'
import { gifTargets, gifTimeline } from '../src/export/gif/timeline'
import { engineSettingsOf, readSettings, type EngineSettings } from '../src/model/settings'
import type { Play } from '../src/model/types'
import { buildScenario, save } from './support/editorActions'
import {
  closeResult,
  exportFromToolbar,
  exportResult,
  longTasks,
  readGif,
  watchLongTasks,
} from './support/exports'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderBytes, readFolderFile } from './support/opfs'

const CHAINED = 'croisee-test--portrait-enchaine.gif'

test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  await stubFolderPicker(page)
  await page.goto('./')
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  await buildScenario(page, 'Croisée test')
  await save(page)
})

async function savedPlay(page: Page): Promise<{ play: Play; settings: EngineSettings }> {
  const [file] = await listFolder(page, 'combinaisons')
  const play = JSON.parse(await readFolderFile(page, `combinaisons/${file ?? ''}`)) as Play
  const read = readSettings(JSON.parse(await readFolderFile(page, 'reglages.json')))
  if (!read.ok) throw new Error(read.message)
  return { play, settings: engineSettingsOf(read.settings) }
}

test('exports the chained GIF into exports/, then « Remplacer » gives the same bytes', async ({
  page,
}) => {
  await watchLongTasks(page)
  await exportFromToolbar(page, 'Exporter GIF', async (dialog) => {
    await expect(dialog.getByTestId('export-file-names')).toHaveText(`Fichier : ${CHAINED}`)
  })
  const first = await exportResult(page)
  expect(first.names).toEqual([CHAINED])
  expect(first.sizes[0]).toMatch(/^\d+(,\d)? (Ko|Mo)$/)
  await closeResult(page)

  const bytes = await readFolderBytes(page, `exports/${CHAINED}`)
  const gif = readGif(bytes)
  const { play, settings } = await savedPlay(page)
  const [target] = gifTargets(play, 'chained')
  if (!target) throw new Error('no GIF target')
  const items = gifTimeline(play, target, 'both', 12, settings, createCaches())
  expect([gif.width, gif.height]).toEqual([540, 960])
  expect(gif.frames).toBe(items.length)
  expect(gif.delays).toEqual(items.map((item) => item.delayCs))
  expect(gif.loop).toBe(0)
  // The interface never froze: no task of the page above 200 ms (HYPOTHÈSE).
  expect(Math.max(0, ...(await longTasks(page)))).toBeLessThan(200)

  await exportFromToolbar(page, 'Exporter GIF')
  const existing = page.getByTestId('export-existing')
  await expect(existing).toContainText(CHAINED)
  await existing.getByRole('button', { name: 'Remplacer' }).click()
  const second = await exportResult(page)
  expect(second.names).toEqual([CHAINED])
  await expect(page.getByTestId('export-result')).toContainText('l’ancien est dans la corbeille')
  const trash = await listFolder(page, '_corbeille')
  expect(trash.filter((name) => name.endsWith(`--${CHAINED}`))).toHaveLength(1)
  const replaced = await readFolderBytes(page, `exports/${CHAINED}`)
  expect(Buffer.compare(replaced, bytes)).toBe(0)
})

test('makes one GIF per option, keeps the preferences, and writes nothing when cancelled', async ({
  page,
}) => {
  await exportFromToolbar(page, 'Exporter GIF', async (dialog) => {
    await dialog.getByLabel('Options').selectOption('perLeaf')
    await dialog.getByLabel('Vitesse').selectOption('real')
  })
  const perLeaf = await exportResult(page)
  expect(perLeaf.names).toEqual([
    'croisee-test--portrait-option-a-reel.gif',
    'croisee-test--portrait-option-b-reel.gif',
  ])
  await closeResult(page)
  for (const name of perLeaf.names) readGif(await readFolderBytes(page, `exports/${name}`))

  // Preferences of reglages.json (D-068), read again after a reload.
  const settings = JSON.parse(await readFolderFile(page, 'reglages.json')) as {
    export: { gif: { lines: string; speed: string } }
  }
  expect(settings.export.gif).toMatchObject({ lines: 'perLeaf', speed: 'real' })
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  await page.getByRole('button', { name: 'Exporter GIF' }).click()
  await expect(page.getByRole('dialog').getByLabel('Options')).toHaveValue('perLeaf')

  // A long export cancelled while its images are encoded: exports/ unchanged.
  const before = await listFolder(page, 'exports')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Qualité').selectOption('high')
  await dialog.getByLabel('Vitesse').selectOption('both')
  await dialog.getByRole('button', { name: 'Exporter', exact: true }).click()
  await expect(page.getByTestId('export-stage')).toContainText('Images', { timeout: 30_000 })
  await page.getByTestId('export-progress').getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByTestId('export-progress')).toBeHidden()
  await expect(page.getByText('Export annulé : aucun fichier écrit.')).toBeVisible()
  expect(await listFolder(page, 'exports')).toEqual(before)
})
