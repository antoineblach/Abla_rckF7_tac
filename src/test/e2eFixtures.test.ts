// The fixtures of the end-to-end tests are the export of their builders: a change of the model
// fails here, in Vitest, before it fails in Playwright.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { packExportFile, parseImportText, playExportFile } from '../io/packFiles'
import { optionsScenarioPlay, playbookPlays } from './builders'

const e2eFixture = (name: string): string =>
  readFileSync(new URL(`../../e2e/fixtures/${name}`, import.meta.url), 'utf8')

describe('fixtures of the end-to-end tests', () => {
  it('options.combi.json is the export of the scenario with options, read as is', () => {
    const text = e2eFixture('options.combi.json')
    expect(text).toBe(playExportFile(optionsScenarioPlay()).text)
    expect(parseImportText(text)).toEqual({ plays: [optionsScenarioPlay()], failures: [] })
  })

  it('cahier.combipack.json is the export of the five plays of the playbook, read as is', () => {
    const text = e2eFixture('cahier.combipack.json')
    expect(text).toBe(packExportFile(playbookPlays(), 'cahier').text)
    expect(parseImportText(text)).toEqual({ plays: playbookPlays(), failures: [] })
  })
})
