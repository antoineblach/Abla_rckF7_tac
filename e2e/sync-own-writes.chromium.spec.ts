import { expect, test, type Page } from '@playwright/test'
import { createSevenVsSeven, fieldToClient, fillCommit, save } from './support/editorActions'
import { stubFolderPicker } from './support/folderStub'
import { focusWindow, listFolder, readFolderFile, writeFolderFile } from './support/opfs'

// Correction after the lot 3 acceptance (D-097 to D-100): working alone, a version written by the
// page is never taken for a change made elsewhere, whatever Drive does with the date or the
// content of its file. Drive is simulated on the stubbed folder: the same text written again (a
// new modification date), then an earlier text of the page given back.

const CONFLICT_TITLE = 'Version plus récente dans le dossier'
const RELOADED = 'Combinaison rechargée depuis le dossier.'

/** Records every appearance of the conflict dialog or of the reload notification. */
async function watchUnexpected(page: Page): Promise<void> {
  await page.evaluate(
    ([conflict, reloaded]) => {
      const seen: string[] = []
      Object.assign(window, { seenUnexpected: seen })
      new MutationObserver(() => {
        const text = document.body.textContent
        for (const message of [conflict, reloaded]) {
          if (text.includes(message) && !seen.includes(message)) seen.push(message)
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true })
    },
    [CONFLICT_TITLE, RELOADED] as const,
  )
}

const unexpected = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { seenUnexpected: string[] }).seenUnexpected)

/**
 * The file, or null while the page is writing it: the private file system refuses a read during a
 * write (NotReadableError, then NotFoundError while the file is replaced).
 */
const readWhenWritten = (page: Page, path: string): Promise<string | null> =>
  readFolderFile(page, path).catch(() => null)

/** Drive changes the modification date after the upload: the same text written again. */
async function driveTouchesDate(page: Page, path: string): Promise<void> {
  await writeFolderFile(page, path, await readFolderFile(page, path))
}

async function press(page: Page, at: [number, number]): Promise<{ x: number; y: number }> {
  const p = await fieldToClient(page, at[0], at[1])
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  return p
}

async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await press(page, from)
  const b = await fieldToClient(page, to[0], to[1])
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}

test('editing, dragging, undoing and saving alone while Drive touches the file: no dialog', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await stubFolderPicker(page)
  await page.goto('./')
  await page
    .getByTestId('degraded-banner')
    .getByRole('button', { name: 'Choisir un dossier' })
    .click()
  // The play must be created in the folder, not in the browser library.
  await expect(page.getByText('Dossier : Rugby7')).toBeVisible()
  await createSevenVsSeven(page, 'Seule')
  await save(page)
  await watchUnexpected(page)
  const [file] = await listFolder(page, 'combinaisons')
  if (!file) throw new Error('no file')
  const path = `combinaisons/${file}`

  // Two saves, Drive touches the date between rereads, two undos, then a save.
  await drag(page, [40, 5], [42, 6])
  await save(page)
  const v1 = await readFolderFile(page, path)
  await drag(page, [40, 15], [43, 16])
  await save(page)
  await driveTouchesDate(page, path)
  await focusWindow(page)
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await driveTouchesDate(page, path)
  await focusWindow(page)
  await save(page)

  // A drag begun just after a change, longer than the automatic save delay: nothing is written
  // before its end, then the save leaves.
  const beforeDrag = await readFolderFile(page, path)
  await drag(page, [40, 25], [41, 26])
  const start = await press(page, [40, 45])
  await page.mouse.move(start.x + 20, start.y, { steps: 4 })
  await page.waitForTimeout(2600)
  expect(await readFolderFile(page, path)).toBe(beforeDrag)
  await page.mouse.move(start.x + 40, start.y + 10, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByTestId('save-status')).toHaveText('Enregistré')
  await driveTouchesDate(page, path)
  await focusWindow(page)
  await page.keyboard.press('Control+z')
  await save(page)

  // Drive gives back an earlier version written by the page: the last one is written back.
  const latest = await readFolderFile(page, path)
  await writeFolderFile(page, path, v1)
  await focusWindow(page)
  await expect.poll(() => readWhenWritten(page, path)).toBe(latest)

  // The same with a change in progress: the change is kept, then saved.
  await fillCommit(page, 'Notes', 'Ma version')
  await writeFolderFile(page, path, v1)
  await focusWindow(page)
  await save(page)
  expect(JSON.parse(await readFolderFile(page, path))).toMatchObject({ notes: 'Ma version' })

  expect(await unexpected(page)).toEqual([])
  await expect(page.getByRole('dialog', { name: CONFLICT_TITLE })).toHaveCount(0)

  // The synchronisation log, copied from the settings (D-100).
  const inspector = page.getByRole('complementary', { name: 'Inspecteur' })
  await inspector.getByText('Réglages (reglages.json)').click()
  await inspector.getByRole('button', { name: 'Copier le journal de synchronisation' }).click()
  await expect(page.getByText('Journal de synchronisation copié.')).toBeVisible()
  const log = await page.evaluate(() => navigator.clipboard.readText())
  expect(log).toContain('Journal de synchronisation')
  expect(log).toContain('retour en arrière')
  expect(log).toContain('sauvegarde différée')
  expect(log).not.toContain('écriture refusée')
})
