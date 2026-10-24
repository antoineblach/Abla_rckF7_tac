import { expect, test, type Page } from '@playwright/test'
import { createSevenVsSeven, drawRun, fieldState, fieldToClient } from './support/editorActions'

// Space bar (SPEC 6.2, D-116), in Chromium and Firefox: a short press plays or pauses; held with a
// drag, it pans without playing; a focused button, checkbox or summary is never activated; typed
// in a text field; ignored on the time slider.

const playButton = (page: Page) => page.getByTitle('Lecture / pause (L)')
const phaseNodes = (page: Page) =>
  page.getByRole('region', { name: 'Arbre des temps' }).locator('.phase-node')

async function playWithARun(page: Page, name: string): Promise<void> {
  await page.goto('./')
  await createSevenVsSeven(page, name)
  // A long run: playback lasts several seconds.
  await drawRun(page, [40, 35], [[80, 35]])
  await expect(playButton(page)).toHaveText('Lecture')
}

test('a short press plays then pauses; held with a drag it pans, without playing', async ({
  page,
}) => {
  await playWithARun(page, 'Espace')
  await page.keyboard.press('Space')
  await expect(playButton(page)).toHaveText('Pause')
  await page.keyboard.press('Space')
  await expect(playButton(page)).toHaveText('Lecture')

  const before = await fieldState(page)
  const from = await fieldToClient(page, 60, 50)
  await page.keyboard.down('Space')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 60, from.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  expect((await fieldState(page)).viewport).not.toEqual(before.viewport)
  await expect(playButton(page)).toHaveText('Lecture')

  // Held longer than a tap, without a drag: nothing either.
  await page.keyboard.down('Space')
  await page.waitForTimeout(700)
  await page.keyboard.up('Space')
  await expect(playButton(page)).toHaveText('Lecture')
})

test('never activates the focused button, checkbox or summary; typed in a field; ignored on the slider', async ({
  page,
}) => {
  await playWithARun(page, 'Focus')
  // Focused button: playback toggles, the button is not clicked.
  const add = page.getByRole('button', { name: 'Ajouter un temps' })
  await add.focus()
  await page.keyboard.press('Space')
  await expect(playButton(page)).toHaveText('Pause')
  await page.keyboard.press('Space')
  await expect(playButton(page)).toHaveText('Lecture')
  await expect(phaseNodes(page)).toHaveCount(1)

  // Focused checkbox: not ticked.
  const loop = page.getByLabel('Boucle', { exact: true })
  const looped = await loop.isChecked()
  await loop.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(playButton(page)).toHaveText('Lecture')
  expect(await loop.isChecked()).toBe(looped)

  // Focused summary: the settings stay folded.
  const summary = page.getByText('Réglages (reglages.json)')
  await summary.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Seuil orange', { exact: true })).toBeHidden()

  // Text field: the space is typed, no playback.
  const name = page
    .getByRole('complementary', { name: 'Inspecteur' })
    .getByLabel('Nom', { exact: true })
  await name.focus()
  await page.keyboard.press('End')
  await page.keyboard.type(' bis')
  await expect(name).toHaveValue('Focus bis')
  await expect(playButton(page)).toHaveText('Lecture')

  // Time slider: ignored.
  const slider = page.getByRole('slider', { name: 'Curseur temporel' })
  await slider.focus()
  await page.keyboard.press('Space')
  await expect(playButton(page)).toHaveText('Lecture')
})
