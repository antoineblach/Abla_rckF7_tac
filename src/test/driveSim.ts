// Simulated behaviours of Google Drive for desktop in streaming mode on the in-memory folder
// (correction after the lot 3 acceptance, D-097, D-098). Unverified hypotheses: they are what the
// tool must withstand, not established facts. Never imported by the application.
import type { MemoryFs } from './memoryFs'

/** Hypothesis 3: after the upload, Drive changes the modification date, not the content. */
export function driveTouchesDate(fs: MemoryFs, path: string): void {
  fs.touch(path)
}

/**
 * Hypothesis 4: when saves follow each other closely, Drive briefly gives back an earlier version
 * of the file (its exact text).
 */
export function driveGivesBack(fs: MemoryFs, path: string, earlierText: string): void {
  fs.writeExternal(path, earlierText)
}

/** Versions of a file as written over time, to give one of them back later. */
export function fileVersions(fs: MemoryFs, path: string): { keep(): string; all(): string[] } {
  const texts: string[] = []
  return {
    keep() {
      const text = fs.read(path)
      if (text === undefined) throw new Error(`No file ${path}`)
      texts.push(text)
      return text
    },
    all: () => [...texts],
  }
}
