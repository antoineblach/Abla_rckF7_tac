// Synchronisation log (D-100): the last events, local times with milliseconds, copied as text.
import { describe, expect, it } from 'vitest'
import { localTime, shortHash, SyncLog } from './syncLog'

const at = (ms: number) => new Date(2026, 9, 23, 14, 2, 11, ms)

describe('synchronisation log (D-100)', () => {
  it('writes local times of the computer with milliseconds', () => {
    expect(localTime(at(7).getTime())).toBe('2026-10-23 14:02:11.007')
    expect(localTime(new Date(2026, 0, 5, 3, 4, 5, 120).getTime())).toBe('2026-01-05 03:04:05.120')
  })

  it('keeps the last events only', () => {
    let ms = 0
    const log = new SyncLog(() => at(ms++), 3)
    for (const detail of ['1', '2', '3', '4', '5']) log.add('read', { detail })
    expect(log.entries().map((e) => e.detail)).toEqual(['3', '4', '5'])
  })

  it('copies one tab-separated line per event, with every field', () => {
    const log = new SyncLog(() => at(123))
    log.add('write', {
      collection: 'plays',
      fileName: 'croisee--x.combi.json',
      lastModified: at(456).getTime(),
      size: 5123,
      updatedAt: '2026-10-23T12:02:11.000Z',
      hash: '0123456789abcd',
      origin: 'page',
    })
    log.add('decision', { collection: 'presets', origin: 'external', detail: 'rechargement' })
    const lines = log.toText().split('\n')
    expect(lines[0]).toBe(
      'Journal de synchronisation : 2 événements, du plus ancien au plus récent',
    )
    expect(lines[1]?.split('\t')).toEqual([
      'heure',
      'événement',
      'collection',
      'fichier',
      'date du fichier',
      'taille',
      'updatedAt',
      'empreinte',
      'origine',
      'détail',
    ])
    expect(lines[2]?.split('\t')).toEqual([
      '2026-10-23 14:02:11.123',
      'écriture',
      'combinaisons',
      'croisee--x.combi.json',
      '2026-10-23 14:02:11.456',
      '5123',
      '2026-10-23T12:02:11.000Z',
      '01234567',
      'cette page',
      '-',
    ])
    expect(lines[3]?.split('\t')).toEqual([
      '2026-10-23 14:02:11.123',
      'décision',
      'modèles',
      '-',
      '-',
      '-',
      '-',
      '-',
      'extérieure',
      'rechargement',
    ])
    expect(shortHash('0123456789abcd')).toBe('01234567')
  })
})
