import type { Page } from '@playwright/test'

/** Lists a directory of the stubbed folder (path relative to « Rugby7 »). */
export function listFolder(page: Page, path = ''): Promise<string[]> {
  return page.evaluate(async (dirPath) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Rugby7')
    for (const part of dirPath.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part)
    const names: string[] = []
    for await (const name of dir.keys()) names.push(name)
    return names.sort()
  }, path)
}

export function readFolderFile(page: Page, path: string): Promise<string> {
  return page.evaluate(async (filePath) => {
    const parts = filePath.split('/')
    const name = parts.pop() ?? ''
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Rugby7')
    for (const part of parts) dir = await dir.getDirectoryHandle(part)
    return (await (await dir.getFileHandle(name)).getFile()).text()
  }, path)
}

/** Writes a file as the other computer would (synchronisation by Drive). */
export function writeFolderFile(page: Page, path: string, content: string): Promise<void> {
  return page.evaluate(
    async ([filePath, text]) => {
      const parts = filePath.split('/')
      const name = parts.pop() ?? ''
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Rugby7')
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true })
      const writable = await (await dir.getFileHandle(name, { create: true })).createWritable()
      await writable.write(text)
      await writable.close()
    },
    [path, content] as const,
  )
}

/** Window focus regained (SPEC 8.3). */
export function focusWindow(page: Page): Promise<void> {
  return page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
  })
}
