// D-127: lint, type check and unit tests in parallel, with a concise output. A passing command
// prints one line; a failing command prints its own output. Exit code 1 if any command fails.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ansiCodes = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

// Each tool runs from its own entry point with the current Node: no shell, so the script behaves
// the same under PowerShell, cmd and Git Bash.
function bin(pkg, name) {
  const dir = join(root, 'node_modules', pkg)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  return join(dir, typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[name])
}

function testSummary(output) {
  const counts = /Tests\s+(\d+) passed(?:\s*\|\s*(\d+) skipped)?/.exec(output)
  if (!counts) return 'tests OK'
  const skipped = counts[2] ? `, ${counts[2]} ignorés` : ''
  return `tests OK : ${counts[1]} réussis${skipped}`
}

const commands = [
  { name: 'lint', file: bin('eslint', 'eslint'), args: ['.'] },
  {
    name: 'types',
    file: bin('typescript', 'tsc'),
    args: ['--noEmit', '--pretty', 'false'],
  },
  {
    name: 'tests',
    file: bin('vitest', 'vitest'),
    args: ['run', '--reporter=minimal', '--silent=passed-only'],
    summary: testSummary,
  },
]

function run({ file, args }) {
  const start = performance.now()
  return new Promise((resolve) => {
    let output = ''
    const finish = (code) => {
      const seconds = Math.round((performance.now() - start) / 1000)
      resolve({ code, output: output.replace(ansiCodes, '').trim(), seconds })
    }
    const child = spawn(process.execPath, [file, ...args], {
      cwd: root,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    })
    child.stdout.setEncoding('utf8').on('data', (chunk) => (output += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk) => (output += chunk))
    child.on('error', (error) => {
      output += String(error)
      finish(1)
    })
    child.on('close', (code) => finish(code ?? 1))
  })
}

const results = await Promise.all(
  commands.map(async (command) => {
    const result = await run(command)
    if (result.code === 0) {
      const line = command.summary ? command.summary(result.output) : `${command.name} OK`
      console.log(`${line} (${result.seconds} s)`)
    } else {
      console.log(`${command.name} en échec (${result.seconds} s) :\n${result.output}\n`)
    }
    return result.code
  }),
)

if (results.some((code) => code !== 0)) process.exitCode = 1
