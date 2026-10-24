import { expect, test, type Page } from '@playwright/test'
import {
  canvas,
  createSevenVsSeven,
  drawPass,
  drawRun,
  fieldState,
  fillCommit,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'

// List of the actions of the phase (SPEC 6.7, D-113): rows sorted with their bars, click that
// selects, hover that halos, Delete then Ctrl+Z, playback, and a field that never moves.

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })
const list = (page: Page) => page.getByRole('region', { name: 'Actions du temps' })
const rows = (page: Page) => list(page).getByTestId('action-row')
const row = (page: Page, title: string) => rows(page).filter({ hasText: title })
const image = (page: Page) =>
  canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('lists the actions of the phase, selects, haloes, deletes and undoes', async ({ page }) => {
  await createSevenVsSeven(page, 'Liste')
  // The pass of A4 to A5 comes first in the play, but leaves at 1 s; A4 and A5 run at once.
  await drawPass(page, [40, 35], [40, 45])
  await drawRun(page, [40, 35], [[46, 37]])
  await drawRun(page, [40, 45], [[47, 48]])
  await expect(list(page).getByRole('heading')).toHaveText('Actions du temps : Temps 1')
  await expect(rows(page)).toHaveCount(3)
  await row(page, 'Passe A 4 → A 5').click()
  await fillCommit(page, 'Délai', '1')
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
  const plain = await image(page)
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

test('follows the phase at t during playback; a click comes back to edit mode', async ({
  page,
}) => {
  await createSevenVsSeven(page, 'Liste en lecture')
  await drawRun(page, [40, 35], [[46, 37]])
  await page.getByRole('button', { name: 'Ajouter un temps' }).click()
  await drawRun(page, [40, 45], [[47, 48]])
  await expect(list(page).getByRole('heading')).toHaveText('Actions du temps : Temps 2')
  await page
    .getByRole('region', { name: 'Arbre des temps' })
    .locator('.phase-node', { hasText: 'Temps 1' })
    .click()
  await expect(list(page).getByRole('heading')).toHaveText('Actions du temps : Temps 1')
  const slider = page.getByRole('slider', { name: 'Curseur temporel' })
  await slider.focus()
  await slider.press('End')
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
  await expect(list(page).getByRole('heading')).toHaveText('Actions du temps : Temps 2')
  await row(page, 'Course A 5').click()
  await expect(canvas(page)).toHaveAttribute('data-mode', 'edit')
  await expect(page.getByTestId('current-phase')).toContainText('Temps 2')
  await expect(inspector(page).getByRole('heading', { name: 'Course de A 5' })).toBeVisible()
})
