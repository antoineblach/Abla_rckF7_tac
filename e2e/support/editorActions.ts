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

export const phaseButton = (page: Page, label: string): Locator =>
  page
    .getByRole('region', { name: 'Arbre des temps' })
    .getByRole('button', { name: label, exact: false })

export async function selectPhase(page: Page, label: string): Promise<void> {
  await page
    .getByRole('region', { name: 'Arbre des temps' })
    .locator('.phase-node', { hasText: label })
    .first()
    .click()
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

/**
 * Acceptance scenario: 7 v 7, trunk of 2 phases, 2 options at phase 3, runs and a pass.
 * Starting placement (D-008): A n at (40, 5 + 10 (n - 1)), ball to A4 at (40, 35).
 */
export async function buildScenario(page: Page, name: string): Promise<void> {
  await createSevenVsSeven(page, name)
  // Phase 1: A4 runs then passes to A5, A5 runs.
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
  // Phase 2.
  await page.getByRole('button', { name: 'Ajouter un temps' }).click()
  await expect(page.getByTestId('current-phase')).toContainText('Temps 2')
  await drawRun(page, [40, 55], [[46, 57]])
  await drawPass(page, [47, 49], [40, 55])
  // Phase 3, then a second option at phase 3.
  await page.getByRole('button', { name: 'Ajouter un temps' }).click()
  await drawRun(
    page,
    [46, 57],
    [
      [52, 60],
      [58, 61],
    ],
  )
  await page.getByRole('button', { name: 'Créer une option à partir d’ici' }).click()
  await expect(page.getByTestId('current-phase')).toContainText('Temps 3, option B')
  await fillCommit(page, 'Condition de l’option', 'Défense montée')
  await fillCommit(page, 'Consigne', 'Retour intérieur')
  await drawPass(page, [46, 57], [47, 49])
  await selectPhase(page, 'Temps 3, option A')
  await fillCommit(page, 'Condition de l’option', 'Défense en retrait')
  await fillCommit(page, 'Consigne', 'On fixe et on donne')
}

/** Image of the canvas at the end of an option (direct jump to t). */
export async function imageAtEndOf(page: Page, optionLabel: string): Promise<string> {
  await selectPhase(page, optionLabel)
  const slider = page.getByRole('slider', { name: 'Curseur temporel' })
  await slider.focus()
  await slider.press('End')
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
  return canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())
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
