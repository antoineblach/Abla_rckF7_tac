import { expect, test, type Page } from '@playwright/test'
import {
  canvas,
  chooseLine,
  clickField,
  clientToField,
  createSevenVsSeven,
  fieldState,
  fieldToClient,
  importOptionsScenario,
  save,
  seekEnd,
  seekStart,
  shakyClickField,
  type FieldState,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'

// The field never changes scale or position because of the other panels (D-048): only the
// wheel, panning, the saved view, the orientation, opening a play, « Ajuster » and « Zone utile »
// change it. The comparison covers the transform and the canvas box on the page. Creating an
// option comes back with the tools of frise-2 (D-148).

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })

async function chooseFolder(page: Page): Promise<void> {
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
}

async function expectUnchanged(page: Page, before: FieldState, gesture: string): Promise<void> {
  expect(await fieldState(page), gesture).toEqual(before)
}

for (const size of [
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
]) {
  test.describe(`window ${String(size.width)}×${String(size.height)}`, () => {
    test.use({ viewport: size })

    test.beforeEach(async ({ page }) => {
      await stubFolderPicker(page)
      await page.goto('./')
    })

    test('selections, notice, playback and option choice leave the field as it is', async ({
      page,
    }) => {
      await chooseFolder(page)
      // The scenario with options (D-148): A n at (40, 5 + 10 (n - 1)), A4 runs then passes to A5.
      await importOptionsScenario(page)
      const before = await fieldState(page)

      await shakyClickField(page, 40, 15)
      await expect(inspector(page).getByRole('heading', { name: 'Joueuse A 2' })).toBeVisible()
      await expectUnchanged(page, before, 'sélection d’une joueuse')

      await shakyClickField(page, 25, 60)
      await expect(inspector(page).getByRole('heading', { name: 'Joueuse A 2' })).toHaveCount(0)
      await expectUnchanged(page, before, 'désélection')

      // The end handle of the run of A4: a click closer to her token would select her.
      await clickField(page, 46, 40)
      await expect(inspector(page).getByRole('heading', { name: 'Course de A 4' })).toBeVisible()
      await expectUnchanged(page, before, 'sélection d’une course')

      // The list of the actions of the line (D-113, D-145): hover and click move nothing.
      const listed = page
        .getByRole('region', { name: 'Actions de la ligne' })
        .getByTestId('action-row')
        .filter({ hasText: 'Passe A 4 → A 5' })
      await listed.hover()
      await expectUnchanged(page, before, 'survol d’une ligne de la liste des actions')
      await listed.click()
      await expect(listed).toHaveAttribute('aria-pressed', 'true')
      await expect(inspector(page).getByRole('heading', { name: 'Passe' })).toBeVisible()
      await expectUnchanged(page, before, 'sélection depuis la liste des actions')

      await chooseLine(page, 'Option B : Défense montée')
      await expectUnchanged(page, before, 'choix d’une ligne')

      await seekEnd(page)
      await expectUnchanged(page, before, 'curseur en fin de ligne')

      // A2 never runs: at the end of the line, a click on her says where placements change.
      const notice = page.getByRole('status').filter({ hasText: 'Le placement de départ' })
      await shakyClickField(page, 40, 15)
      await expect(notice).toBeVisible()
      await expectUnchanged(page, before, 'apparition d’un message')

      await seekStart(page)
      await expect(notice).toHaveCount(0)
      await expectUnchanged(page, before, 'disparition du message')

      await page.getByRole('button', { name: 'Lecture', exact: true }).click()
      const chooser = page.getByRole('group', { name: 'Point d’option' })
      await expect(chooser).toBeVisible({ timeout: 15_000 })
      await expectUnchanged(page, before, 'lecture et apparition du choix d’option')

      await chooser.getByRole('button').nth(1).click()
      await expect(
        page.getByRole('combobox', { name: 'Ligne' }).locator('option:checked'),
      ).toHaveText('Option B : Défense montée')
      await expectUnchanged(page, before, 'choix d’option')

      await shakyClickField(page, 25, 60)
      await expect(canvas(page)).toHaveAttribute('data-mode', 'edit')
      await expectUnchanged(page, before, 'clic sur le terrain pendant ou après la lecture')
    })

    test('the banner floats over the field: its disappearance moves nothing', async ({ page }) => {
      // The banner exists only without a folder (or at start-up when the folder must be
      // authorised again): with a play open, it can only disappear, when a folder is chosen.
      await expect(page.getByTestId('degraded-banner')).toBeVisible()
      await createSevenVsSeven(page, 'Bandeau')
      const before = await fieldState(page)
      await chooseFolder(page)
      await expect(page.getByTestId('degraded-banner')).toHaveCount(0)
      await expect(page.getByRole('dialog')).toContainText('Les copier dans le dossier choisi ?')
      await expectUnchanged(page, before, 'disparition du bandeau')
      await page.getByRole('button', { name: 'Ne pas copier' }).click()
      await expectUnchanged(page, before, 'fermeture du dialogue')
    })
  })
}

test.describe('voluntary changes of the view', () => {
  test.use({ viewport: { width: 1536, height: 864 } })

  test.beforeEach(async ({ page }) => {
    await stubFolderPicker(page)
    await page.goto('./')
    await chooseFolder(page)
    await createSevenVsSeven(page, 'Vue')
  })

  test('wheel, Space + drag, « Ajuster », F, window resize and full screen', async ({ page }) => {
    const initial = await fieldState(page)

    // Wheel: zoom by one step around the cursor, which stays over the same field point.
    // Whole pixels: the browser rounds the pointer position.
    const near = await fieldToClient(page, 30, 20)
    const cursor = { x: Math.round(near.x), y: Math.round(near.y) }
    await page.mouse.move(cursor.x, cursor.y)
    const under = await clientToField(page, cursor.x, cursor.y)
    await page.mouse.wheel(0, -100)
    await expect
      .poll(async () => (await fieldState(page)).viewport.scale)
      .toBeCloseTo(initial.viewport.scale * 1.15, 6)
    const afterZoom = await clientToField(page, cursor.x, cursor.y)
    expect(afterZoom.x).toBeCloseTo(under.x, 4)
    expect(afterZoom.y).toBeCloseTo(under.y, 4)

    // Space + drag: the grabbed point follows the pointer.
    await page.keyboard.down('Space')
    await page.mouse.down()
    await page.mouse.move(cursor.x + 60, cursor.y + 30, { steps: 4 })
    await page.mouse.move(cursor.x + 120, cursor.y + 60, { steps: 4 })
    await page.mouse.up()
    await page.keyboard.up('Space')
    const dragged = await clientToField(page, cursor.x + 120, cursor.y + 60)
    expect(dragged.x).toBeCloseTo(under.x, 4)
    expect(dragged.y).toBeCloseTo(under.y, 4)

    // F and « Ajuster » come back to the saved view.
    await page.keyboard.press('f')
    await expect.poll(async () => (await fieldState(page)).viewport).toEqual(initial.viewport)
    await page.mouse.wheel(0, -100)
    await expect
      .poll(async () => (await fieldState(page)).viewport.scale)
      .toBeGreaterThan(initial.viewport.scale)
    await page.getByRole('button', { name: 'Ajuster' }).click()
    await expect.poll(async () => (await fieldState(page)).viewport).toEqual(initial.viewport)

    // « Zone utile »: the players and their runs, plus 5 m (here 35 to 55 m by 0 to 70 m), fill
    // the canvas: closer than the whole field. F comes back.
    await page.getByRole('button', { name: 'Zone utile' }).click()
    await expect
      .poll(async () => (await fieldState(page)).viewport.scale)
      .toBeGreaterThan(initial.viewport.scale * 1.03)
    await page.keyboard.press('f')
    await expect.poll(async () => (await fieldState(page)).viewport).toEqual(initial.viewport)

    // Smaller window: same scale, same field point at the centre of the canvas.
    const centre = (state: FieldState) =>
      clientToField(page, state.box.x + state.box.width / 2, state.box.y + state.box.height / 2)
    const centreBefore = await centre(initial)
    await page.setViewportSize({ width: 1300, height: 760 })
    await expect
      .poll(async () => (await fieldState(page)).box.width)
      .toBeLessThan(initial.box.width)
    const resized = await fieldState(page)
    expect(resized.viewport.scale).toBeCloseTo(initial.viewport.scale, 9)
    const centreAfter = await centre(resized)
    expect(centreAfter.x).toBeCloseTo(centreBefore.x, 1)
    expect(centreAfter.y).toBeCloseTo(centreBefore.y, 1)

    // Full screen: a bigger canvas, the same scale.
    await page.getByRole('button', { name: 'Plein écran' }).click()
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
    await expect
      .poll(async () => (await fieldState(page)).box.height)
      .toBeGreaterThan(resized.box.height)
    expect((await fieldState(page)).viewport.scale).toBeCloseTo(initial.viewport.scale, 9)
    await page.getByRole('button', { name: 'Plein écran' }).click()
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
  })

  test('« Combinaison » stays at the top of the inspector, foldable, folded state kept', async ({
    page,
  }) => {
    const name = inspector(page).getByLabel('Nom', { exact: true })
    await expect(name).toBeVisible()
    await shakyClickField(page, 40, 5)
    await expect(inspector(page).getByRole('heading', { name: 'Joueuse A 1' })).toBeVisible()
    await expect(name).toBeVisible()
    await inspector(page).getByText('Combinaison', { exact: true }).click()
    await expect(name).toBeHidden()
    await save(page)
    await page.reload()
    await page.getByRole('button', { name: 'Ouvrir Vue' }).click()
    await expect(inspector(page).getByLabel('Nom', { exact: true })).toBeHidden()
    await inspector(page).getByText('Combinaison', { exact: true }).click()
    await expect(inspector(page).getByLabel('Nom', { exact: true })).toBeVisible()
  })
})
