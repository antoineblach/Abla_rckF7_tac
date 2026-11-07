// Engine validations (SPEC 4.3, 5.3, 5.4) over every line of the play. A block of the trunk compiles
// the same way in every line that contains it, so issues are merged without duplicates.
import type { EngineSettings } from '../model/settings'
import { allLines } from '../model/branches'
import { issueKey, type Issue } from '../model/issues'
import type { Play } from '../model/types'
import type { EvalCaches } from './caches'
import { compileLine } from './timeline'

export function engineIssues(play: Play, settings: EngineSettings, caches: EvalCaches): Issue[] {
  const seen = new Set<string>()
  const result: Issue[] = []
  for (const line of allLines(play)) {
    for (const issue of compileLine(play, line, settings, caches).issues) {
      const key = issueKey(issue)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(issue)
    }
  }
  return result
}
