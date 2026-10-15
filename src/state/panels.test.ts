import { afterEach, describe, expect, it, vi } from 'vitest'

describe('folded panels (D-026, D-052)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('remembers the folded library and « Combinaison » section per computer', async () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
    })
    const { DEFAULT_PREFS, loadPrefs } = await import('./prefs')
    const { setLibraryCollapsed, setPlaySectionCollapsed, usePanelsStore } =
      await import('./panelsStore')
    expect(DEFAULT_PREFS).toMatchObject({ libraryCollapsed: false, playSectionCollapsed: false })
    expect(usePanelsStore.getState()).toEqual({
      libraryCollapsed: false,
      playSectionCollapsed: false,
    })
    setPlaySectionCollapsed(true)
    setLibraryCollapsed(true)
    expect(usePanelsStore.getState()).toEqual({
      libraryCollapsed: true,
      playSectionCollapsed: true,
    })
    expect(loadPrefs()).toMatchObject({ libraryCollapsed: true, playSectionCollapsed: true })
  })
})
