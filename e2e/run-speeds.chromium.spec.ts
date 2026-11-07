import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import {
  canvasImage,
  clickField,
  createSevenVsSeven,
  drawPass,
  drawRun,
  fillCommit,
  lineDuration,
  playFrozen,
  save,
  stableImage,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderFile, writeFolderFile } from './support/opfs'

// Lot 3 bis in the interface (D-106 to D-117): segment speed by the key 3 then typed in km/h,
// red threshold (inspector, list, badge and its layer remembered), settings written in
// reglages.json v4, reglages.json v2 at 7 m/s migrated with its message, pass on receipt laid by
// the tool at « Bord suivant » (D-167, D-171). Lot 3bis-1 (D-134): reglages.json v3 with the former
// default acceleration migrated with its message; typed pace of a run saved in a version 5 file;
// speed slider (drag, release, arrow keys, undo; D-133); imposed duration kept with its factors and
// acceleration alerts (D-130, D-132); top speed and acceleration thresholds in the settings.
// « Caler sur… » comes back with the glues laid by hand, in frise-2 (D-148).

/** Read from the root of the repository, where the tests run. */
const SETTINGS_V2 = 'src/test/fixtures/reglages-v2.json'
const SETTINGS_V3 = 'src/test/fixtures/reglages-v3.json'

interface StoredPlay {
  schemaVersion: number
  actions: { id: string; type: string; [key: string]: unknown }[]
}

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })
const list = (page: Page) => page.getByRole('region', { name: 'Actions de la ligne' })
const row = (page: Page, title: string) =>
  list(page).getByTestId('action-row').filter({ hasText: title })

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
  await page.clock.install()
  await page.goto('./')
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
  expect(play.schemaVersion).toBe(5)
  const run = play.actions.find((a) => a.type === 'run') as
    { waypoints: { x: number; y: number; speed?: unknown }[] } | undefined
  expect(run?.waypoints[1]?.speed).toBeCloseTo(7.5, 3)

  // Player: the red badge on the « Vitesses » layer, remembered on this computer. The editor always
  // shows the badges (D-112): the layer is seen during playback, near the end of the run.
  await playFrozen(page, (await lineDuration(page)) * 1000 - 300)
  const withBadge = await stableImage(page)
  const layer = page.getByLabel('Vitesses', { exact: true })
  await expect(layer).toBeChecked()
  await layer.uncheck()
  await expect.poll(() => canvasImage(page)).not.toBe(withBadge)
  await page.clock.resume()
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Vitesses' }).click()
  await expect(page.getByRole('checkbox', { name: 'Vitesses', exact: true })).not.toBeChecked()
})

test('typed pace of a run in km/h, saved in m/s in a version 5 file (D-133)', async ({ page }) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Allure saisie')
  await drawRun(page, [40, 35], [[60, 38]])
  await row(page, 'Course A 4').click()
  const pace = inspector(page).getByLabel('Allure', { exact: true })
  await pace.selectOption('custom')
  await fillCommit(page, 'Allure saisie', '18')
  await expect(pace).toHaveValue('custom')
  await expect(inspector(page).getByLabel('Allure saisie', { exact: true })).toHaveValue('18')
  await save(page)
  const play = await storedPlay(page)
  expect(play.schemaVersion).toBe(5)
  const run = play.actions.find((a) => a.type === 'run')
  expect(run?.pace).toBeCloseTo(5, 3)
  // Back to a named pace.
  await pace.selectOption('sprint')
  await expect(inspector(page).getByLabel('Allure saisie', { exact: true })).toHaveCount(0)
})

/** Thumb width of the speed slider, in pixels (global.css, --speed-thumb). */
const THUMB_PX = 14

/** Drags the speed slider to `kmh` (track from 1 to 30 km/h with the default settings). */
async function dragSlider(page: Page, label: string, kmh: number): Promise<void> {
  const slider = inspector(page).getByRole('slider', { name: label, exact: true })
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  if (!box) throw new Error('no slider')
  const xOf = (value: number) => box.x + THUMB_PX / 2 + ((box.width - THUMB_PX) * (value - 1)) / 29
  const y = box.y + box.height / 2
  await page.mouse.move(xOf(10), y)
  await page.mouse.down()
  await page.mouse.move(xOf(kmh), y, { steps: 8 })
  await page.mouse.up()
}

async function storedRunPace(page: Page): Promise<unknown> {
  await save(page)
  return (await storedPlay(page)).actions.find((a) => a.type === 'run')?.pace
}

test('speed slider: snaps to a pace marker, typed speed elsewhere, one undo step per gesture (D-133)', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Curseur')
  await drawRun(page, [40, 35], [[60, 38]])
  await row(page, 'Course A 4').click()
  const pace = inspector(page).getByLabel('Allure', { exact: true })
  const value = inspector(page).getByTestId('speed-slider-value')
  await expect(value).toHaveText('4,0 m/s (14,4 km/h), Trot')
  await expect(inspector(page).getByTestId('speed-marker-sprint')).toBeVisible()

  // Released 0,3 km/h below the sprint marker: the named pace.
  await dragSlider(page, 'Curseur de l’allure', 19.5)
  await expect(pace).toHaveValue('sprint')
  await expect(value).toHaveText('5,5 m/s (19,8 km/h), Sprint')
  expect(await storedRunPace(page)).toBe('sprint')

  // Released away from the markers: a typed speed in m/s, shown in the km/h field.
  await dragSlider(page, 'Curseur de l’allure', 17)
  await expect(pace).toHaveValue('custom')
  const typed = await storedRunPace(page)
  expect(typed).toBeCloseTo(17 / 3.6, 1)
  await expect(inspector(page).getByLabel('Allure saisie', { exact: true })).toBeVisible()

  // One undo step for the whole gesture: back to the sprint.
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(pace).toHaveValue('sprint')

  // Arrow keys: 0,1 km/h per key; a value equal to a marker gives its pace.
  const slider = inspector(page).getByRole('slider', { name: 'Curseur de l’allure', exact: true })
  await slider.focus()
  await slider.press('ArrowLeft')
  await expect(pace).toHaveValue('custom')
  await expect(value).toHaveText('5,5 m/s (19,7 km/h)')
  await slider.press('ArrowRight')
  await expect(pace).toHaveValue('sprint')

  // A segment of its own speed: the slider is offered once « Allure de la course » is left.
  await clickField(page, 55, 37)
  const segment = inspector(page).getByRole('group', { name: 'Segment 1' })
  await expect(segment.getByRole('slider')).toHaveCount(0)
  await segment.getByLabel('Vitesse du segment').selectOption('walk')
  await dragSlider(page, 'Curseur du segment', 14.6)
  await expect(segment.getByLabel('Vitesse du segment')).toHaveValue('jog')
})

test('accelerations: an imposed duration far too short is kept, with its factors and alerts (D-130, D-132)', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Accélérations')
  await drawRun(page, [40, 35], [[60, 35]])
  await row(page, 'Course A 4').click()
  await inspector(page).getByLabel('Durée imposée').check()
  await fillCommit(page, 'Durée', '1.5')
  await expect(inspector(page).getByTestId('run-duration')).toHaveText('Durée de la course : 1,5 s')
  await expect(inspector(page).getByTestId('run-factors')).toHaveText(
    /^Durée imposée : vitesses × \d+,\d\d, accélérations × \d+,\d\d\.$/,
  )
  await expect(
    inspector(page).locator('.inspector__fact--danger', { hasText: /accélération \d+,\d m\/s²/ }),
  ).toBeVisible()
  const badge = row(page, 'Course A 4').locator('.action-row__badge--error')
  await expect(badge).toHaveAttribute(
    'title',
    /accélération de \d+,\d m\/s², au-delà du seuil rouge/,
  )
  await expect(row(page, 'Course A 4')).toHaveAttribute('title', /Durée imposée : vitesses ×/)
  // The layer of the player keeps its name, with its tooltip.
  await expect(page.getByTitle('Vitesses et accélérations')).toContainText('Vitesses')
})

test('the pass tool releases on receipt at « Bord suivant »: the pass follows the receipt (D-171)', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'À la réception')
  await drawPass(page, [40, 35], [40, 45])
  // « Bord suivant » brings the cursor exactly onto the arrival of the pass (D-167).
  await page.getByRole('button', { name: 'Bord suivant' }).click()
  await drawPass(page, [40, 45], [40, 55])
  await row(page, 'Passe A 5 → A 6').click()
  await expect(inspector(page).getByTestId('start-glue')).toHaveText(
    'Départ collé à : arrivée de la passe A 4 → A 5',
  )
  await expect(inspector(page).getByLabel('Temps de contrôle', { exact: true })).toHaveValue('0')
  await save(page)
  const passes = (await storedPlay(page)).actions.filter((a) => a.type === 'pass')
  expect(passes.map((p) => p.startGlue)).toEqual([
    undefined,
    { targetId: passes[0]?.id, event: 'end' },
  ])
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
  await expect(inspector(page).getByText('m/s (24,0 km/h)')).toBeVisible()
  await fillCommit(page, 'Pointe de la joueuse', '7')
  await fillCommit(page, 'Seuil rouge d’accélération', '9')
  // Orange at most red: 12 is brought back to 7.
  await fillCommit(page, 'Seuil orange de freinage', '12')
  await expect(inspector(page).getByLabel('Seuil orange de freinage', { exact: true })).toHaveValue(
    '7',
  )
  await expect
    .poll(async () => {
      const text = await readFolderFile(page, 'reglages.json').catch(() => null)
      if (text === null) return null
      const settings = JSON.parse(text) as {
        schemaVersion: number
        speedAlert: { warning: number }
        motion: { accel: number; topSpeed: number }
        accelAlert: { danger: number }
        decelAlert: { warning: number }
      }
      return [
        settings.schemaVersion,
        Math.round(settings.speedAlert.warning * 1000),
        settings.motion.accel,
        settings.motion.topSpeed,
        settings.accelAlert.danger,
        settings.decelAlert.warning,
      ]
    })
    .toEqual([4, 5000, 2.5, 7, 9, 7])
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
