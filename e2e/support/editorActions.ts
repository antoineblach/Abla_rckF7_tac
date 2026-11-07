import { expect, type Locator, type Page } from '@playwright/test'

interface ViewportData {
  scale: number
  originX: number
  originY: number
  ex: { x: number; y: number }
  ey: { x: number; y: number }
}

export const canvas = (page: Page): Locator => page.getByTestId('field-canvas')

/** Client coordinates of a field point in metres, from the transform exposed by the canvas. */
export async function fieldToClient(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const element = canvas(page)
  const data = JSON.parse((await element.getAttribute('data-viewport')) ?? '{}') as ViewportData
  const box = await element.boundingBox()
  if (!box) throw new Error('canvas not visible')
  return {
    x: box.x + data.originX + data.scale * (data.ex.x * x + data.ey.x * y),
    y: box.y + data.originY + data.scale * (data.ex.y * x + data.ey.y * y),
  }
}

export async function clickField(page: Page, x: number, y: number): Promise<void> {
  const p = await fieldToClient(page, x, y)
  await page.mouse.click(p.x, p.y)
}

/** Run tool: click the player at `from`, then each point, then Enter (SPEC 6.2). */
export async function drawRun(
  page: Page,
  from: [number, number],
  points: [number, number][],
): Promise<void> {
  await page.keyboard.press('r')
  await clickField(page, from[0], from[1])
  for (const [x, y] of points) await clickField(page, x, y)
  await page.keyboard.press('Enter')
  await page.keyboard.press('v')
}

/** Pass tool: passer then receiver. */
export async function drawPass(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  await page.keyboard.press('p')
  await clickField(page, from[0], from[1])
  await clickField(page, to[0], to[1])
  await page.keyboard.press('v')
}

export async function fillCommit(page: Page, label: string, value: string): Promise<void> {
  const field = page
    .getByRole('complementary', { name: 'Inspecteur' })
    .getByLabel(label, { exact: true })
  await field.fill(value)
  await field.blur()
}

export async function createSevenVsSeven(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Nouvelle combinaison' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '7 contre 7 en ligne' }).click()
  await expect(canvas(page)).toBeVisible()
  await fillCommit(page, 'Nom', name)
}

/** Time slider of the transport bar. */
export const timeSlider = (page: Page): Locator =>
  page.getByRole('slider', { name: 'Curseur temporel' })

/** Cursor at the end of the line read, playback stopped; the slider gives the keys back. */
export async function seekEnd(page: Page): Promise<void> {
  const slider = timeSlider(page)
  await slider.focus()
  await slider.press('End')
  await expect(page.getByTestId('transport-time')).toHaveText(/^(\S+ s) \/ \1$/)
  await slider.blur()
}

/** Cursor at t = 0; the slider gives the keys back. */
export async function seekStart(page: Page): Promise<void> {
  const slider = timeSlider(page)
  await slider.focus()
  await slider.press('Home')
  await expect(page.getByTestId('transport-time')).toHaveText(/^0,0 s \//)
  await slider.blur()
}

/** Duration of the line read, in seconds, as the transport bar shows it (to 0,1 s). */
export async function lineDuration(page: Page): Promise<number> {
  const text = (await page.getByTestId('transport-time').textContent()) ?? ''
  const match = /\/ (\d+),(\d) s$/.exec(text)
  if (!match) throw new Error(`no duration in « ${text} »`)
  return Number(`${match[1] ?? ''}.${match[2] ?? ''}`)
}

/** Liste « Ligne » (D-142): the line labelled by its options, « Option B : Défense montée ». */
export async function chooseLine(page: Page, label: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Ligne', exact: true }).selectOption({ label })
}

/**
 * Acceptance scenario of a line without option (D-148): 7 v 7; A4 and A5 run, A4 passes to A5 at
 * once; at the end of the line, A6 runs and A5 passes to her; at the end again, A6 runs on from the
 * end of her run, glued to it (SPEC 6.2). Starting placement (D-008): A n at (40, 5 + 10 (n - 1)),
 * ball to A4 at (40, 35).
 */
export async function buildScenario(page: Page, name: string): Promise<void> {
  await createSevenVsSeven(page, name)
  await drawRun(
    page,
    [40, 35],
    [
      [44, 37],
      [46, 40],
    ],
  )
  await drawRun(
    page,
    [40, 45],
    [
      [43, 47],
      [47, 49],
    ],
  )
  await drawPass(page, [40, 35], [40, 45])
  await seekEnd(page)
  await drawRun(page, [40, 55], [[46, 57]])
  await drawPass(page, [47, 49], [40, 55])
  await seekEnd(page)
  await drawRun(
    page,
    [46, 57],
    [
      [52, 60],
      [58, 61],
    ],
  )
}

/** The scenario with options of the e2e tests, « Croisée test » (D-148), imported then opened. */
export const OPTIONS_SCENARIO = 'e2e/fixtures/options.combi.json'

export async function importOptionsScenario(page: Page): Promise<void> {
  await page.getByTestId('import-input').setInputFiles(OPTIONS_SCENARIO)
  await expect(page.getByText('Combinaison importée.')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir Croisée test' }).click()
  await expect(canvas(page)).toBeVisible()
}

/** Image of the canvas at the end of a line, chosen by its label when there are several. */
export async function imageAtEndOf(page: Page, lineLabel?: string): Promise<string> {
  if (lineLabel !== undefined) await chooseLine(page, lineLabel)
  await seekEnd(page)
  await settle(page)
  return canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())
}

/** Image of the field canvas, as a data URL. */
export const canvasImage = (page: Page): Promise<string> =>
  canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())

/** Image once the canvas no longer changes (no animation frame: the clock may be paused). */
export async function stableImage(page: Page): Promise<string> {
  let previous = ''
  await expect
    .poll(async () => {
      const current = await canvasImage(page)
      const same = current === previous
      previous = current
      return same
    })
    .toBe(true)
  return previous
}

/**
 * Playback frozen after `ms` of playing time, from the cursor. The clock of the page must have
 * been installed before it loaded (`page.clock.install()`): playback then advances only when the
 * test moves the clock, and images compare at a fixed t. `page.clock.resume()` lets time flow again.
 */
export async function playFrozen(page: Page, ms: number): Promise<void> {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  await page.getByRole('button', { name: 'Lecture', exact: true }).click()
  await page.clock.runFor(ms)
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
}

export async function save(page: Page): Promise<void> {
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-status')).toHaveText('Enregistré')
}

/** Click as a hand does: the pointer shakes by one pixel between the press and the release. */
export async function shakyClickField(page: Page, x: number, y: number): Promise<void> {
  const p = await fieldToClient(page, x, y)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.move(p.x + 1, p.y)
  await page.mouse.up()
}

/** Waits two frames: resize observers and redraws have run. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }),
  )
}

export interface FieldState {
  viewport: ViewportData
  box: { x: number; y: number; width: number; height: number }
}

/** Transform of the field and position of its canvas on the page. */
export async function fieldState(page: Page): Promise<FieldState> {
  await settle(page)
  const element = canvas(page)
  const viewport = JSON.parse((await element.getAttribute('data-viewport')) ?? '{}') as ViewportData
  const box = await element.boundingBox()
  if (!box) throw new Error('canvas not visible')
  return { viewport, box }
}

/** Field point (metres) under a client position, from the transform exposed by the canvas. */
export async function clientToField(
  page: Page,
  clientX: number,
  clientY: number,
): Promise<{ x: number; y: number }> {
  const { viewport: v, box } = await fieldState(page)
  const dx = (clientX - box.x - v.originX) / v.scale
  const dy = (clientY - box.y - v.originY) / v.scale
  return { x: dx * v.ex.x + dy * v.ex.y, y: dx * v.ey.x + dy * v.ey.y }
}
