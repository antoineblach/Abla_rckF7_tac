import { expect, test, type Page } from '@playwright/test'
import {
  canvas,
  canvasImage,
  chooseLine,
  createSevenVsSeven,
  drawPass,
  drawRun,
  fieldState,
  fillCommit,
  importOptionsScenario,
  playFrozen,
  seekEnd,
  stableImage,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'

// List of the actions of the line (SPEC 6.7, D-113, D-145): rows sorted with their bars, click that
// selects, hover that haloes the whole line at rest and the scene at t during playback (D-173),
// Delete then Ctrl+Z, line chosen in « Ligne », and a field that never moves. A run drawn from the
// end of the previous run of the player is glued to it (SPEC 6.2, D-175).

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })
const list = (page: Page) => page.getByRole('region', { name: 'Actions de la ligne' })
const rows = (page: Page) => list(page).getByTestId('action-row')
const row = (page: Page, title: string) => rows(page).filter({ hasText: title })
const image = canvasImage

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('lists the actions of the line, selects, haloes, deletes and undoes', async ({ page }) => {
  await createSevenVsSeven(page, 'Liste')
  // The pass of A4 to A5 comes first in the play, but leaves at 1 s; A4 and A5 run at once.
  await drawPass(page, [40, 35], [40, 45])
  await drawRun(page, [40, 35], [[46, 37]])
  await drawRun(page, [40, 45], [[47, 48]])
  await expect(list(page).getByRole('heading')).toHaveText('Actions de la ligne')
  await expect(rows(page)).toHaveCount(3)
  await row(page, 'Passe A 4 → A 5').click()
  await fillCommit(page, 'Départ', '1')
  // Sorted by start: the two runs at 0, in the order of the play, then the pass.
  await expect(rows(page).nth(0)).toContainText('Course A 4')
  await expect(rows(page).nth(1)).toContainText('Course A 5')
  await expect(rows(page).nth(2)).toContainText('Passe A 4 → A 5')
  const runBar = rows(page).nth(0).getByTestId('action-bar')
  await expect(runBar).toHaveAttribute('style', /left: 0%/)
  const passBar = rows(page).nth(2).getByTestId('action-bar')
  expect(await passBar.getAttribute('style')).not.toMatch(/left: 0%/)
  await expect(rows(page).nth(0)).toHaveAttribute('title', /Vitesse de pointe : .* km\/h\)/)

  const before = await fieldState(page)
  // Hover: a halo on the field.
  await page.mouse.move(5, 5)
  const plain = await stableImage(page)
  await row(page, 'Passe A 4 → A 5').hover()
  await expect.poll(() => image(page)).not.toBe(plain)
  await page.mouse.move(5, 5)
  await expect.poll(() => image(page)).toBe(plain)

  // Click: the pass is selected, in the inspector and in the list.
  await row(page, 'Passe A 4 → A 5').click()
  await expect(inspector(page).getByRole('heading', { name: 'Passe' })).toBeVisible()
  await expect(row(page, 'Passe A 4 → A 5')).toHaveAttribute('aria-pressed', 'true')
  await expect(inspector(page).getByTestId('release-real')).toContainText('Lâcher réel')
  expect(await fieldState(page)).toEqual(before)

  // Delete, then Ctrl+Z.
  await page.keyboard.press('Delete')
  await expect(rows(page)).toHaveCount(2)
  await page.keyboard.press('Control+z')
  await expect(rows(page)).toHaveCount(3)
  expect(await fieldState(page)).toEqual(before)
})

test('a run drawn from the end of the previous run of the player is glued to it (D-175)', async ({
  page,
}) => {
  await createSevenVsSeven(page, 'Course collée')
  await drawRun(page, [40, 35], [[46, 37]])
  // At the end of the line, A4 stands on the end handle of her run: the tool clicks the player.
  await seekEnd(page)
  await drawRun(page, [46, 37], [[52, 41]])
  await expect(rows(page).filter({ hasText: 'Course A 4' })).toHaveCount(2)
  await rows(page).nth(1).click()
  await expect(inspector(page).getByRole('heading', { name: 'Course de A 4' })).toBeVisible()
  await expect(inspector(page).getByTestId('start-glue')).toHaveText(
    'Départ collé à : fin de la course de A 4',
  )
  await expect(inspector(page).getByTestId('block-start-computed')).toContainText('Départ calculé')
  await expect(rows(page).nth(1)).toHaveAttribute('title', /Départ collé à : fin de la course/)

  // « Décoller »: the start is a plain field again; Ctrl+Z glues it back.
  await inspector(page).getByRole('button', { name: 'Décoller le départ' }).click()
  await expect(inspector(page).getByTestId('start-glue')).toHaveCount(0)
  await expect(inspector(page).getByLabel('Départ', { exact: true })).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(inspector(page).getByTestId('start-glue')).toBeVisible()
})

test('follows the line chosen in « Ligne »', async ({ page }) => {
  await importOptionsScenario(page)
  await expect(list(page).getByRole('heading')).toHaveText(
    'Actions de la ligne : Option A : Défense en retrait',
  )
  await expect(row(page, 'Passe A 6 → A 7')).toHaveCount(1)
  await chooseLine(page, 'Option B : Défense montée')
  await expect(list(page).getByRole('heading')).toHaveText(
    'Actions de la ligne : Option B : Défense montée',
  )
  await expect(row(page, 'Passe A 6 → A 7')).toHaveCount(0)
  await expect(row(page, 'Passe A 6 → A 5')).toHaveCount(1)
})

test('halo of a hovered row: whole line at rest, scene at t during playback (D-173)', async ({
  page,
}) => {
  // Playback advances only when the test moves the clock: the images compare at a fixed t.
  await page.clock.install()
  await page.goto('./')
  await importOptionsScenario(page)
  const later = () => row(page, 'Course A 7')
  const current = () => row(page, 'Course A 4')

  // At rest at t = 0: the run of A7, in option A, is not drawn yet; its halo is.
  await page.mouse.move(5, 5)
  const atRest = await stableImage(page)
  await later().hover()
  await expect.poll(() => image(page)).not.toBe(atRest)
  await page.mouse.move(5, 5)
  await expect.poll(() => image(page)).toBe(atRest)

  // Playback, the clock paused at about 0,5 s: A4 runs, A7 is not drawn in the scene.
  await playFrozen(page, 500)
  await expect(current()).toHaveAttribute('aria-current', 'true')
  await expect(later()).not.toHaveAttribute('aria-current', 'true')
  const playing = await stableImage(page)
  await later().hover()
  expect(await stableImage(page)).toBe(playing)
  await current().hover()
  await expect.poll(() => image(page)).not.toBe(playing)
  await page.mouse.move(5, 5)
  await expect.poll(() => image(page)).toBe(playing)

  // A click on a row during playback: back to editing at the cursor, the run selected.
  await current().click()
  await expect(canvas(page)).toHaveAttribute('data-mode', 'edit')
  await expect(inspector(page).getByRole('heading', { name: 'Course de A 4' })).toBeVisible()
  await page.mouse.move(5, 5)
  const paused = await stableImage(page)
  await later().hover()
  await expect.poll(() => image(page)).not.toBe(paused)
})
