import type { Page } from '@playwright/test'

/**
 * The native folder picker cannot be automated: in tests, showDirectoryPicker returns a
 * sub-folder « Rugby7 » of the origin private file system (DECISIONS D-035).
 */
export async function stubFolderPicker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory()
      return root.getDirectoryHandle('Rugby7', { create: true })
    }
  })
}
