import { expect, test, type Page } from '@playwright/test'
import {
  canvas,
  clickField,
  createSevenVsSeven,
  fieldToClient,
  fillCommit,
  save,
} from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { focusWindow, listFolder, readFolderFile, writeFolderFile } from './support/opfs'

// Lot 3 set pieces in the interface (SPEC 10.1, 10.2, D-087 to D-092, D-096): presets saved in
// modeles/, applied by their anchor, managed in the « Modèles » tab, new play from a preset,
// whole play moved and flipped.

interface StoredPlay {
  name: string
  category: string
  entities: { id: string; kind: string; team?: string; number?: number }[]
  setup: { positions: Record<string, { x: number; y: number }>; ballCarrierId: string | null }
}

interface StoredPreset {
  name: string
  type: string
  positions: { role: string; number: number; forward: number; openSide: number }[]
  ball: { carrierRole?: string; carrierNumber?: number } | null
}

const library = (page: Page) => page.getByRole('complementary', { name: 'Bibliothèque' })
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspecteur' })
const banner = (page: Page) => page.getByTestId('placement-banner')
const presetItem = (page: Page, name: string) =>
  library(page).getByRole('listitem', { name: `Modèle ${name}`, exact: true })

async function chooseFolder(page: Page): Promise<void> {
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
}

async function presetsTab(page: Page): Promise<void> {
  await library(page).getByRole('tab', { name: 'Modèles' }).click()
}

/** « Enregistrer un modèle… », then the anchor clicked at (x, y). */
async function savePreset(
  page: Page,
  options: { name: string; type: string; openSide?: string },
  anchor: [number, number],
): Promise<void> {
  await presetsTab(page)
  await library(page).getByRole('button', { name: 'Enregistrer un modèle…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Enregistrer un modèle' })
  await dialog.getByLabel('Nom').fill(options.name)
  await dialog.getByLabel('Type').selectOption({ label: options.type })
  if (options.openSide)
    await dialog.getByLabel('Côté ouvert').selectOption({ label: options.openSide })
  await dialog.getByRole('button', { name: 'Cliquer le point d’ancrage' }).click()
  await expect(banner(page)).toContainText(`Enregistrer « ${options.name} »`)
  await clickField(page, anchor[0], anchor[1])
  await expect(page.getByText(`Modèle « ${options.name} » enregistré.`)).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
}

async function storedPreset(page: Page, prefix: string): Promise<StoredPreset> {
  const file = (await listFolder(page, 'modeles')).find((f) => f.startsWith(`${prefix}--`))
  if (!file) throw new Error(`no preset ${prefix}`)
  return JSON.parse(await readFolderFile(page, `modeles/${file}`)) as StoredPreset
}

async function storedPlay(page: Page, prefix: string): Promise<StoredPlay> {
  const file = (await listFolder(page, 'combinaisons')).find((f) => f.startsWith(`${prefix}--`))
  if (!file) throw new Error(`no play ${prefix}`)
  return JSON.parse(await readFolderFile(page, `combinaisons/${file}`)) as StoredPlay
}

function positionOf(play: StoredPlay, team: string, number: number) {
  const entity = play.entities.find((e) => e.team === team && e.number === number)
  return entity ? play.setup.positions[entity.id] : undefined
}

test.beforeEach(async ({ page }) => {
  await stubFolderPicker(page)
  await page.goto('./')
  await chooseFolder(page)
})

test('saves a lineout preset in modeles/, applies it at the other touchline and when B attacks', async ({
  page,
}) => {
  await createSevenVsSeven(page, 'Touche')
  // Any point of the upper half: the anchor snaps on the touchline y = 0, at x = 40.
  await savePreset(page, { name: 'Touche test', type: 'Touche' }, [40, 20])
  const preset = await storedPreset(page, 'touche-test')
  expect(preset).toMatchObject({
    name: 'Touche test',
    type: 'lineout',
    ball: { carrierRole: 'attack', carrierNumber: 4 },
  })
  expect(preset.positions).toHaveLength(14)
  expect(preset.positions).toContainEqual({ role: 'defense', number: 1, forward: 10, openSide: 5 })

  // Applied at the other touchline: no open side to choose for a lineout.
  await presetItem(page, 'Touche test').getByRole('button', { name: 'Appliquer' }).click()
  await expect(banner(page)).toContainText('Modèle « Touche test » : cliquez le point d’ancrage.')
  await expect(banner(page).getByRole('group', { name: 'Côté ouvert' })).toHaveCount(0)
  // Less than 5 m from a goal line: refused, the click changes nothing.
  const refused = await fieldToClient(page, 3, 20)
  await page.mouse.move(refused.x, refused.y)
  await expect(banner(page)).toContainText('Marque de touche à moins de 5 m d’une ligne de but')
  await page.mouse.click(refused.x, refused.y)
  await expect(banner(page)).toBeVisible()
  await clickField(page, 60, 50)
  await expect(banner(page)).toHaveCount(0)
  await expect(inspector(page).getByLabel('Catégorie')).toHaveValue('lineout')
  await save(page)
  let play = await storedPlay(page, 'touche')
  expect(positionOf(play, 'A', 1)).toEqual({ x: 60, y: 65 })
  expect(positionOf(play, 'B', 1)).toEqual({ x: 70, y: 65 })

  // B attacks: the attack role goes to B, forward is towards -x.
  await inspector(page).getByLabel('Équipe qui attaque').selectOption({ label: 'B (orange)' })
  await presetItem(page, 'Touche test').getByRole('button', { name: 'Appliquer' }).click()
  await expect(banner(page)).toBeVisible()
  await clickField(page, 60, 20)
  await save(page)
  play = await storedPlay(page, 'touche')
  expect(positionOf(play, 'B', 1)).toEqual({ x: 60, y: 5 })
  expect(positionOf(play, 'A', 1)).toEqual({ x: 50, y: 5 })
  const carrier = play.entities.find((e) => e.id === play.setup.ballCarrierId)
  expect(carrier).toMatchObject({ team: 'B', number: 4 })

  // Escape cancels a placement.
  await presetItem(page, 'Touche test').getByRole('button', { name: 'Appliquer' }).click()
  await expect(banner(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(banner(page)).toHaveCount(0)
})

test('adds a defence preset saved from a selection, and creates a play from a preset', async ({
  page,
}) => {
  await createSevenVsSeven(page, 'Source')
  // Box selection of the B line (x = 50).
  const from = await fieldToClient(page, 47, 2)
  const to = await fieldToClient(page, 53, 68)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 5 })
  await page.mouse.up()
  await presetsTab(page)
  await library(page).getByRole('button', { name: 'Enregistrer un modèle…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Enregistrer un modèle' })
  await expect(dialog.getByRole('radio', { name: 'Sélection (7 joueuses)' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Inclure le ballon' })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await savePreset(page, { name: 'Défense', type: 'Libre', openSide: 'Droite' }, [45, 35])
  const preset = await storedPreset(page, 'defense')
  expect(preset.positions.map((p) => p.role)).toEqual(Array<string>(7).fill('defense'))
  expect(preset.ball).toBeNull()

  // A play with team A only: the defence preset creates the B players.
  await library(page).getByRole('tab', { name: 'Combinaisons' }).click()
  await page.getByRole('button', { name: 'Nouvelle combinaison', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Équipe A seule en ligne' }).click()
  await expect(inspector(page).getByLabel('Nom', { exact: true })).toHaveValue(
    'Nouvelle combinaison',
  )
  await fillCommit(page, 'Nom', 'Attaque seule')
  await presetsTab(page)
  await presetItem(page, 'Défense').getByRole('button', { name: 'Appliquer' }).click()
  await banner(page).getByRole('button', { name: 'Droite' }).click()
  await clickField(page, 45, 35)
  await save(page)
  const play = await storedPlay(page, 'attaque-seule')
  expect(play.entities.filter((e) => e.team === 'B')).toHaveLength(7)
  expect(positionOf(play, 'B', 3)).toEqual({ x: 50, y: 25 })
  expect(positionOf(play, 'A', 3)).toEqual({ x: 40, y: 25 })
  expect(play.category).toBe('phasePlay')

  // New play from a preset (D-091): no players, then the anchor.
  await library(page).getByRole('tab', { name: 'Combinaisons' }).click()
  await page.getByRole('button', { name: 'Nouvelle combinaison', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Défense (Libre)' }).click()
  await expect(banner(page)).toContainText('Modèle « Défense »')
  await clickField(page, 60, 35)
  await fillCommit(page, 'Nom', 'Depuis modèle')
  await save(page)
  const created = await storedPlay(page, 'depuis-modele')
  expect(created.entities.filter((e) => e.kind === 'player')).toHaveLength(7)
  expect(positionOf(created, 'B', 1)).toEqual({ x: 65, y: 5 })
})

test('renames, duplicates and removes presets; reads a preset of the other computer', async ({
  page,
}) => {
  await createSevenVsSeven(page, 'Gestion')
  await savePreset(page, { name: 'Ligne', type: 'Libre' }, [45, 35])
  const [first] = await listFolder(page, 'modeles')
  const id = first?.replace(/^ligne--/, '').replace(/\.preset\.json$/, '') ?? ''

  await presetItem(page, 'Ligne').getByRole('button', { name: 'Renommer' }).click()
  const rename = page.getByRole('dialog', { name: 'Renommer le modèle' })
  await rename.getByLabel('Nom').fill('Ligne avancée')
  await rename.getByRole('button', { name: 'Renommer' }).click()
  await expect(presetItem(page, 'Ligne avancée')).toBeVisible()
  expect(await listFolder(page, 'modeles')).toEqual([`ligne-avancee--${id}.preset.json`])
  expect(
    (await listFolder(page, '_corbeille')).some((f) => f.endsWith(`ligne--${id}.preset.json`)),
  ).toBe(true)

  await presetItem(page, 'Ligne avancée').getByRole('button', { name: 'Dupliquer' }).click()
  await expect(presetItem(page, 'Ligne avancée (copie)')).toBeVisible()
  expect(await listFolder(page, 'modeles')).toHaveLength(2)
  await presetItem(page, 'Ligne avancée (copie)').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Déplacer dans la corbeille' }).click()
  await expect(presetItem(page, 'Ligne avancée (copie)')).toHaveCount(0)
  expect(await listFolder(page, 'modeles')).toEqual([`ligne-avancee--${id}.preset.json`])
  expect(await listFolder(page, '_corbeille')).toHaveLength(2)

  // A preset written by the other computer appears when the window gets the focus back.
  const other = {
    ball: null,
    createdAt: '2026-10-16T09:00:00.000Z',
    id: '6f1d1f3e-8a4b-4c2d-9e3f-1a2b3c4d5e6f',
    name: 'Mêlée PC 2',
    positions: [{ forward: -1, number: 9, openSide: 0.5, role: 'attack' }],
    schemaVersion: 1,
    type: 'scrum',
    updatedAt: '2026-10-16T09:00:00.000Z',
  }
  await writeFolderFile(
    page,
    `modeles/melee-pc-2--${other.id}.preset.json`,
    `${JSON.stringify(other, null, 2)}\n`,
  )
  await focusWindow(page)
  await expect(presetItem(page, 'Mêlée PC 2')).toBeVisible()
  await expect(presetItem(page, 'Mêlée PC 2')).toContainText('Mêlée · 1 joueuse')
})

test('moves the whole play by two clicks and flips it', async ({ page }) => {
  await createSevenVsSeven(page, 'Déplacée')
  await page.getByRole('button', { name: 'Grille 1 m' }).click()
  await inspector(page).getByRole('button', { name: 'Déplacer la combinaison' }).click()
  await expect(banner(page)).toContainText('cliquez le point de départ')
  await clickField(page, 40, 35)
  await expect(banner(page)).toContainText('cliquez le point d’arrivée')
  await clickField(page, 45, 30)
  await expect(banner(page)).toHaveCount(0)
  await save(page)
  let play = await storedPlay(page, 'deplacee')
  expect(positionOf(play, 'A', 4)).toEqual({ x: 45, y: 30 })
  expect(positionOf(play, 'B', 1)).toEqual({ x: 55, y: 0 })

  await inspector(page).getByRole('button', { name: 'Retourner' }).click()
  await save(page)
  play = await storedPlay(page, 'deplacee')
  expect(positionOf(play, 'A', 4)).toEqual({ x: 45, y: 40 })
  expect(positionOf(play, 'B', 1)).toEqual({ x: 55, y: 70 })
  await page.keyboard.press('Control+z')
  await expect(canvas(page)).toBeVisible()
  await save(page)
  expect(positionOf(await storedPlay(page, 'deplacee'), 'A', 4)).toEqual({ x: 45, y: 30 })
})
