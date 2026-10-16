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
import { listFolder, readFolderFile } from './support/opfs'

// Lot 3 in the interface: ruck laid with the G tool (support and relayer proposed, then changed),
// kick to a point with the J tool, forward pass layer of the player, toolbar width (D-078 to
// D-085, D-093).

interface StoredAction {
  type: string
  [key: string]: unknown
}

interface StoredPlay {
  schemaVersion: number
  entities: { id: string; kind: string; team?: string; number?: number }[]
  phases: { actions: StoredAction[] }[]
}

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })

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

const idOf = (play: StoredPlay, team: string, number: number): string =>
  play.entities.find((e) => e.team === team && e.number === number)?.id ?? '?'

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('lays a ruck with G and a kick with J, edited in the inspector and saved', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Ruck et pied')
  // A4 carries the ball and runs into contact.
  await drawRun(page, [40, 35], [[46, 36]])
  await page.keyboard.press('g')
  await expect(page.getByTitle('Regroupement (G)')).toHaveAttribute('aria-pressed', 'true')
  await clickField(page, 40, 35)
  const section = inspector(page).getByRole('region', { name: 'Regroupement' })
  await expect(section.getByRole('heading')).toHaveText('Regroupement sur A 4')
  // Proposal: the two closest teammates at the formation, A5 then A3 (D-081).
  await expect(section.getByLabel('Soutien').locator('option:checked')).toHaveText('A 5')
  await expect(section.getByLabel('Relayeur').locator('option:checked')).toHaveText('A 3')
  await section.getByLabel('Relayeur').selectOption({ label: 'A 2' })
  await fillCommit(page, 'Durée', '2')
  await section.getByLabel('Défense au regroupement').selectOption({ label: 'Gratteur' })
  await section.getByLabel('Type').selectOption({ label: 'Maul' })

  // Phase 2: the relayer A2 kicks to a point from the relay position (45, 36).
  await page.getByRole('button', { name: 'Ajouter un temps' }).click()
  await expect(page.getByTestId('current-phase')).toContainText('Temps 2')
  await page.keyboard.press('j')
  await clickField(page, 45, 36)
  await clickField(page, 70, 20)
  await expect(inspector(page).getByRole('heading', { name: 'Jeu au pied de A 2' })).toBeVisible()
  await expect(inspector(page).getByLabel('Cible').locator('option:checked')).toHaveText(
    'Point du terrain',
  )
  await save(page)

  const play = await storedPlay(page)
  expect(play.schemaVersion).toBe(2)
  const ruck = play.phases[0]?.actions.find((a) => a.type === 'breakdown')
  expect(ruck).toMatchObject({
    kind: 'maul',
    tackledId: idOf(play, 'A', 4),
    supportId: idOf(play, 'A', 5),
    relayerId: idOf(play, 'A', 2),
    duration: 2,
    contest: 'jackal',
  })
  const kick = play.phases[1]?.actions.find((a) => a.type === 'kick') as
    { kickerId: string; kind: string; target: { point: { x: number; y: number } } } | undefined
  expect(kick?.kickerId).toBe(idOf(play, 'A', 2))
  expect(kick?.kind).toBe('long')
  expect(kick?.target.point.x).toBeCloseTo(70, 0)
  expect(kick?.target.point.y).toBeCloseTo(20, 0)

  // The breakdown tool refuses a player without the ball, with a message.
  await page.keyboard.press('g')
  await clickField(page, 40, 5)
  await expect(page.getByText('Regroupement : cliquez une joueuse qui a le ballon')).toBeVisible()
})

test('the forward pass layer changes the player image and is remembered', async ({ page }) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Passe en avant')
  // A5 runs ahead, A4 still passes to her at once: forward in the passer frame (SPEC 5.7).
  await drawRun(page, [40, 45], [[52, 45]])
  await drawPass(page, [40, 35], [40, 45])
  await expect(inspector(page).getByText('En-avant probable').first()).toBeVisible()
  const slider = page.getByRole('slider', { name: 'Curseur temporel' })
  await slider.focus()
  await slider.press('End')
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
  const image = () => canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())
  const withBadge = await image()
  await page.getByRole('checkbox', { name: 'En-avant' }).uncheck()
  await expect.poll(image).not.toBe(withBadge)
  await save(page)
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Passe en avant' }).click()
  await expect(page.getByRole('checkbox', { name: 'En-avant' })).not.toBeChecked()
})

test('the whole toolbar stays visible at 1440 px, new tools included', async ({ page }) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Barre')
  const tools = page.getByRole('toolbar', { name: 'Outils' }).getByRole('button')
  expect(await tools.count()).toBe(8)
  for (const button of await tools.all()) await expect(button).toBeInViewport({ ratio: 1 })
  for (const name of ['Exporter GIF', 'Exporter PDF', 'Changer de dossier']) {
    await expect(page.getByRole('button', { name })).toBeInViewport({ ratio: 1 })
  }
})
