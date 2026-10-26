import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import {
  canvas,
  clickField,
  createSevenVsSeven,
  drawPass,
  drawRun,
  fillCommit,
  save,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderFile, writeFolderFile } from './support/opfs'

// Lot 3 bis in the interface (D-106 to D-117): segment speed by the key 3 then typed in km/h,
// red threshold (inspector, list, badge and its layer remembered), « Caler sur… » a pass and the
// run following it, loop refused, settings written in reglages.json v4, reglages.json v2 at
// 7 m/s migrated with its message, pass on receipt laid by the tool. Lot 3bis-1 (D-134):
// reglages.json v3 with the former default acceleration migrated with its message.

/** Read from the root of the repository, where the tests run. */
const SETTINGS_V2 = 'src/test/fixtures/reglages-v2.json'
const SETTINGS_V3 = 'src/test/fixtures/reglages-v3.json'

interface StoredPlay {
  schemaVersion: number
  phases: { actions: { type: string; [key: string]: unknown }[] }[]
}

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })
const list = (page: Page) => page.getByRole('region', { name: 'Actions du temps' })
const row = (page: Page, title: string) =>
  list(page).getByTestId('action-row').filter({ hasText: title })
const image = (page: Page) =>
  canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())

async function chooseFolder(page: Page): Promise<void> {
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
}

async function storedPlay(page: Page): Promise<StoredPlay> {
  const files = (await listFolder(page, 'combinaisons')).filter((f) => f.endsWith('.combi.json'))
  expect(files).toHaveLength(1)
  return JSON.parse(await readFolderFile(page, `combinaisons/${files[0] ?? ''}`)) as StoredPlay
}

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('segment speed by key and in km/h; red threshold in the inspector, the list and its layer', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Vitesses')
  // A4: a short first segment, a long second one.
  await drawRun(
    page,
    [40, 35],
    [
      [45, 38],
      [68, 38],
    ],
  )
  await clickField(page, 58, 38)
  const segment = inspector(page).getByRole('group', { name: 'Segment 2' })
  await expect(segment).toBeVisible()
  await page.keyboard.press('3')
  await expect(segment.getByLabel('Vitesse du segment')).toHaveValue('sprint')
  await segment.getByLabel('Vitesse du segment').selectOption('custom')
  await fillCommit(page, 'Vitesse saisie', '27')
  await expect(
    inspector(page)
      .getByText(/^Segment 2 : 2\d,\d km\/h, au-delà du seuil rouge/)
      .first(),
  ).toBeVisible()
  await expect(row(page, 'Course A 4').locator('.action-row__badge--error')).toBeVisible()
  await save(page)
  const play = await storedPlay(page)
  expect(play.schemaVersion).toBe(3)
  const run = play.phases[0]?.actions.find((a) => a.type === 'run') as
    { waypoints: { x: number; y: number; speed?: unknown }[] } | undefined
  expect(run?.waypoints[1]?.speed).toBeCloseTo(7.5, 3)

  // Player: the red badge on the « Vitesses » layer, remembered on this computer.
  const slider = page.getByRole('slider', { name: 'Curseur temporel' })
  await slider.focus()
  await slider.press('End')
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
  const withBadge = await image(page)
  const layer = page.getByLabel('Vitesses', { exact: true })
  await expect(layer).toBeChecked()
  await layer.uncheck()
  await expect.poll(() => image(page)).not.toBe(withBadge)
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Vitesses' }).click()
  await expect(page.getByRole('checkbox', { name: 'Vitesses', exact: true })).not.toBeChecked()
})

test('« Caler sur… » the arrival of a pass: the run follows the pass; a loop is refused', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Rendez-vous')
  // A4 passes to A5 (both still); A6 and A7 run a little.
  await drawPass(page, [40, 35], [40, 45])
  await drawRun(page, [40, 55], [[42, 53]])
  await drawRun(page, [40, 65], [[43, 63]])
  await row(page, 'Passe A 4 → A 5').click()
  await fillCommit(page, 'Délai', '1')

  await row(page, 'Course A 6').click()
  await inspector(page).getByRole('button', { name: 'Caler sur…' }).click()
  await expect(page.getByTestId('sync-banner')).toContainText('Caler la course de A 6 (fin)')
  // On the pass, closer to its arrival than to its release.
  await clickField(page, 40, 42)
  await expect(page.getByTestId('sync-banner')).toHaveCount(0)
  await expect(inspector(page).getByTestId('sync-target')).toHaveText(
    'Calée sur : arrivée de la passe A 4 → A 5',
  )
  const result = inspector(page).getByTestId('sync-result')
  await expect(result).toContainText('Délai calculé')
  const first = await result.textContent()

  // The pass leaves one second later: the computed delay follows.
  await row(page, 'Passe A 4 → A 5').click()
  await fillCommit(page, 'Délai', '2')
  await row(page, 'Course A 6').click()
  await expect(inspector(page).getByTestId('sync-result')).toContainText('Délai calculé')
  await expect(inspector(page).getByTestId('sync-result')).not.toHaveText(first ?? '')

  // A7 on the end of A6, then A6 on A7: refused, with a message; Escape ends the choice.
  await row(page, 'Course A 7').click()
  await inspector(page).getByRole('button', { name: 'Caler sur…' }).click()
  // The end handle of the run of A6 (the line is short, next to her token).
  await clickField(page, 42, 53)
  await expect(inspector(page).getByTestId('sync-target')).toHaveText(
    'Calée sur : fin de la course de A 6',
  )
  await row(page, 'Course A 6').click()
  await inspector(page).getByRole('button', { name: 'Changer la cible' }).click()
  await clickField(page, 43, 63)
  await expect(page.getByText('Lien refusé : il créerait une boucle de liens.')).toBeVisible()
  await expect(page.getByTestId('sync-banner')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('sync-banner')).toHaveCount(0)
  await expect(inspector(page).getByTestId('sync-target')).toHaveCount(0)
})

test('the pass tool releases on receipt a pass from a receiver', async ({ page }) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'À la réception')
  await drawPass(page, [40, 35], [40, 45])
  await drawPass(page, [40, 45], [40, 55])
  await row(page, 'Passe A 5 → A 6').click()
  await expect(inspector(page).getByLabel('Lâcher', { exact: true })).toHaveValue('onReceipt')
  await expect(inspector(page).getByLabel('Temps de contrôle', { exact: true })).toHaveValue('0')
  await save(page)
  const passes = (await storedPlay(page)).phases[0]?.actions.filter((a) => a.type === 'pass')
  expect(passes?.map((p) => p.release)).toEqual([undefined, 'onReceipt'])
})

test('settings: thresholds in km/h and speed profile written in reglages.json v4', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Réglages')
  await inspector(page).getByText('Réglages (reglages.json)').click()
  await expect(inspector(page).getByText('m/s (19,8 km/h)')).toBeVisible()
  await fillCommit(page, 'Seuil orange', '18')
  await fillCommit(page, 'Accélération', '2.5')
  await expect
    .poll(async () => {
      const text = await readFolderFile(page, 'reglages.json').catch(() => null)
      if (text === null) return null
      const settings = JSON.parse(text) as {
        schemaVersion: number
        speedAlert: { warning: number }
        motion: { accel: number }
      }
      return [
        settings.schemaVersion,
        Math.round(settings.speedAlert.warning * 1000),
        settings.motion.accel,
      ]
    })
    .toEqual([4, 5000, 2.5])
})

test('reglages.json v2 with the former sprint of 7 m/s: 5,5 m/s and a message', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await (await navigator.storage.getDirectory()).getDirectoryHandle('Rugby7', { create: true })
  })
  // The frozen fixture of lot 3 bis: reglages.json v2 with the former sprint of 7 m/s.
  await writeFolderFile(page, 'reglages.json', readFileSync(SETTINGS_V2, 'utf8'))
  await chooseFolder(page)
  await expect(page.getByText('Allure sprint ramenée de 7 à 5,5 m/s')).toBeVisible()
  await createSevenVsSeven(page, 'Sprint')
  await inspector(page).getByText('Réglages (reglages.json)').click()
  await expect(inspector(page).getByLabel('Sprint', { exact: true })).toHaveValue('5.5')
})

test('reglages.json v3 with the former default acceleration: 5,2 m/s² and a message', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await (await navigator.storage.getDirectory()).getDirectoryHandle('Rugby7', { create: true })
  })
  // The frozen fixture of lot 3bis-1: reglages.json v3 with the defaults of lot 3 bis.
  await writeFolderFile(page, 'reglages.json', readFileSync(SETTINGS_V3, 'utf8'))
  await chooseFolder(page)
  await expect(
    page.getByText(
      'Profil de vitesse calibré, nouvelles valeurs par défaut : accélération de 3 à 5,2 m/s²',
    ),
  ).toBeVisible()
  await createSevenVsSeven(page, 'Accélération')
  await inspector(page).getByText('Réglages (reglages.json)').click()
  await expect(inspector(page).getByLabel('Accélération', { exact: true })).toHaveValue('5.2')
  // Read, not rewritten: still version 3 until the settings are saved.
  expect(
    (JSON.parse(await readFolderFile(page, 'reglages.json')) as { schemaVersion: number })
      .schemaVersion,
  ).toBe(3)
})
