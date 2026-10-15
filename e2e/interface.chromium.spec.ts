import { expect, test, type Page } from '@playwright/test'
import {
  canvas,
  clickField,
  createSevenVsSeven,
  drawPass,
  drawRun,
  fieldToClient,
  fillCommit,
  save,
  selectPhase,
  shakyClickField,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { listFolder, readFolderFile } from './support/opfs'

// Wiring of the interface (lot 1 acceptance, automated per D-054): every control reaches the play
// written in the folder, or the preferences of the computer.

interface StoredPlay {
  category: string
  attackingTeam: string
  entities: { id: string; kind: string; team?: string; number?: number }[]
  setup: { positions: Record<string, { x: number; y: number }>; ballCarrierId: string | null }
  phases: {
    id: string
    parentId: string | null
    isDefault: boolean
    instruction: string
    actions: { type: string; entityId?: string; pace?: string; waypoints?: unknown[] }[]
  }[]
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
  const files = await listFolder(page, 'combinaisons')
  expect(files).toHaveLength(1)
  return JSON.parse(await readFolderFile(page, `combinaisons/${files[0] ?? ''}`)) as StoredPlay
}

async function dragField(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = await fieldToClient(page, from[0], from[1])
  const b = await fieldToClient(page, to[0], to[1])
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 6 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
})

test('toolbar, inspector, keyboard and phase tree edit the play written in the folder', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Interface')
  const panel = inspector(page)
  await panel.getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Mêlée' })

  // Grid, « Placer A », number changed in the inspector.
  const grid = page.getByRole('button', { name: 'Grille 1 m' })
  await grid.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await page.getByTitle('Placer A (A)').click()
  await clickField(page, 20.3, 30.4)
  await page.getByTitle('Sélection (V)').click()
  await shakyClickField(page, 20, 30)
  await expect(panel.getByRole('heading', { name: 'Joueuse A 8' })).toBeVisible()
  const number = panel.getByLabel('Numéro', { exact: true })
  await number.fill('12')
  await number.press('Enter')
  await expect(panel.getByRole('heading', { name: 'Joueuse A 12' })).toBeVisible()

  // Drag on the grid; Suppr, Ctrl+Z, Ctrl+Y.
  await dragField(page, [40, 5], [42.2, 8.1])
  await shakyClickField(page, 40, 15)
  await page.keyboard.press('Delete')
  await page.keyboard.press('Control+z')
  await shakyClickField(page, 40, 15)
  await expect(panel.getByRole('heading', { name: 'Joueuse A 2' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+y')
  await shakyClickField(page, 40, 15)
  await expect(panel.getByRole('heading', { name: 'Joueuse A 2' })).toHaveCount(0)

  // Ball removed, added back, given to A3; attack by B.
  await panel.getByRole('button', { name: 'Retirer le ballon' }).click()
  await panel.getByRole('button', { name: 'Ajouter le ballon' }).click()
  await shakyClickField(page, 40, 25)
  await panel.getByLabel('Porteuse du ballon au départ').check()
  // The focus stays on the checkbox: the shortcuts keep working (only text fields, lists and
  // the time slider keep the keys for themselves).
  await panel.getByLabel('Équipe qui attaque', { exact: true }).selectOption('B')

  // Run of 4 points; right click on the second point; pace changed: the duration follows.
  await drawRun(
    page,
    [40, 45],
    [
      [43, 46],
      [46, 48],
      [49, 47],
      [52, 49],
    ],
  )
  const point = await fieldToClient(page, 46, 48)
  await page.mouse.click(point.x, point.y, { button: 'right' })
  // On the run, away from the tokens (players are hit first).
  await clickField(page, 46, 46.5)
  const duration = panel.getByTestId('run-duration')
  const before = await duration.textContent()
  const pace = panel.getByLabel('Allure', { exact: true })
  await pace.selectOption({ index: 2 })
  await pace.blur()
  await expect(duration).not.toHaveText(before ?? '')

  // Pass to the other team: alert shown.
  await drawPass(page, [40, 25], [50, 25])
  await expect(panel.getByText('Passe vers l’autre équipe.').first()).toBeVisible()

  // Phases: two more, an option made default, a phase inserted after phase 1, long instruction.
  await page.getByRole('button', { name: 'Ajouter un temps' }).click()
  await page.getByRole('button', { name: 'Ajouter un temps' }).click()
  await page.getByRole('button', { name: 'Créer une option à partir d’ici' }).click()
  await panel.getByLabel('Option par défaut').check()
  await selectPhase(page, 'Temps 1')
  await page.getByRole('button', { name: 'Insérer un temps après' }).click()
  await expect(page.getByTestId('current-phase')).toContainText('Temps 2')
  await expect(
    page.getByRole('region', { name: 'Arbre des temps' }).getByText('Temps 4, option B'),
  ).toBeVisible()
  await fillCommit(page, 'Consigne', 'x'.repeat(61))
  await expect(panel.getByText('61 caractères : au-delà de 60')).toBeVisible()
  await expect(panel.getByText(/^Consigne longue \(61 caractères/)).toBeVisible()

  // Automatic save, without Ctrl+S.
  await expect(page.getByTestId('save-status')).toHaveText('Enregistré', { timeout: 10_000 })
  const play = await storedPlay(page)
  const id = (team: string, n: number) =>
    play.entities.find((e) => e.kind === 'player' && e.team === team && e.number === n)?.id ?? ''
  expect(play.category).toBe('scrum')
  expect(play.attackingTeam).toBe('B')
  expect(play.setup.positions[id('A', 12)]).toEqual({ x: 20, y: 30 })
  expect(play.setup.positions[id('A', 1)]).toEqual({ x: 42, y: 8 })
  expect(id('A', 2)).toBe('')
  expect(play.setup.ballCarrierId).toBe(id('A', 3))
  expect(play.entities.filter((e) => e.kind === 'ball')).toHaveLength(1)
  const run = play.phases
    .flatMap((p) => p.actions)
    .find((a) => a.type === 'run' && a.entityId === id('A', 5))
  expect(run?.waypoints).toHaveLength(3)
  expect(run?.pace).toBe('sprint')
  expect(play.phases).toHaveLength(5)
  const options = play.phases.filter((p) => p.parentId !== null && !p.actions.length)
  expect(options.some((p) => p.isDefault)).toBe(true)
  expect(play.phases.some((p) => p.instruction === 'x'.repeat(61))).toBe(true)
})

test('player controls are remembered by the computer; layers change the image', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Lecteur')
  const slider = page.getByRole('slider', { name: 'Curseur temporel' })
  await drawRun(page, [40, 35], [[46, 38]])
  await slider.focus()
  await slider.press('End')
  await expect(canvas(page)).toHaveAttribute('data-mode', 'play')
  const image = () => canvas(page).evaluate((element) => (element as HTMLCanvasElement).toDataURL())
  const withGainLine = await image()
  await page.getByLabel('Ligne d’avantage').uncheck()
  await expect.poll(image).not.toBe(withGainLine)
  const withoutGainLine = await image()
  await page.getByLabel('Traces').uncheck()
  await expect.poll(image).not.toBe(withoutGainLine)

  await page.getByRole('checkbox', { name: 'Consigne' }).uncheck()
  await page.getByLabel('Boucle').check()
  await page.getByLabel('Pause entre les temps').check()
  await page.getByLabel('S’arrêter aux options').uncheck()
  await page.getByRole('combobox', { name: 'Vitesse' }).selectOption('2')
  const orientation = page.getByRole('combobox', { name: 'Orientation' })
  await orientation.selectOption('portrait')
  await orientation.blur()
  await expect
    .poll(async () => {
      const box = await canvas(page).boundingBox()
      return box ? Math.round((box.width / box.height) * 100) / 100 : 0
    })
    .toBeCloseTo(9 / 16, 1)

  await save(page)
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Lecteur' }).click()
  await expect(page.getByLabel('Ligne d’avantage')).not.toBeChecked()
  await expect(page.getByLabel('Traces')).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Consigne' })).not.toBeChecked()
  await expect(page.getByLabel('Boucle')).toBeChecked()
  await expect(page.getByLabel('Pause entre les temps')).toBeChecked()
  await expect(page.getByLabel('S’arrêter aux options')).not.toBeChecked()
  await expect(page.getByRole('combobox', { name: 'Vitesse' })).toHaveValue('2')
  await expect(page.getByRole('combobox', { name: 'Orientation' })).toHaveValue('portrait')
})

test('a tab closed less than 2 s after a change offers « Restaurer le brouillon »', async ({
  page,
}) => {
  await chooseFolder(page)
  await createSevenVsSeven(page, 'Brouillon')
  await expect(page.getByTestId('save-status')).toHaveText('Enregistré', { timeout: 10_000 })
  await page.getByTitle('Placer B (B)').click()
  await clickField(page, 60, 30)
  // The draft is written after 0.5 s, the file after 2 s: reload in between.
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('Brouillon retrouvé')
  await page.getByRole('button', { name: 'Restaurer le brouillon' }).click()
  await expect(canvas(page)).toBeVisible()
  // The restored play holds the player placed before closing, and is saved again.
  await expect
    .poll(async () => {
      const play = await storedPlay(page)
      return play.entities.some((e) => e.kind === 'player' && e.team === 'B' && e.number === 8)
    })
    .toBe(true)
})
