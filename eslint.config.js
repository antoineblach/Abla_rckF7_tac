// @ts-check
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// CLAUDE.md rule 7: engine and render are pure (no clock, no randomness, no global state).
const clockProperties = [
  { object: 'Date', property: 'now', message: 'Pure code: pass the time as a parameter.' },
  { object: 'Math', property: 'random', message: 'Pure code: no randomness.' },
  { object: 'performance', property: 'now', message: 'Pure code: pass the time as a parameter.' },
]
const clockSyntax = [
  { selector: "NewExpression[callee.name='Date']", message: 'Pure code: no clock.' },
  { selector: "CallExpression[callee.name='Date']", message: 'Pure code: no clock.' },
]
const pureGlobals = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'navigator',
]
const pureImports = {
  patterns: [
    {
      group: ['react', 'react-dom', 'react/*', 'zustand', 'zustand/*'],
      message: 'No UI or state library in pure code.',
    },
    {
      group: ['**/io/**', '**/ui/**', '**/state/**', '**/editor/**', '**/player/**'],
      message: 'Pure layers must not depend on application layers.',
    },
    { group: ['node:*'], message: 'No Node API in application code.' },
  ],
}

// CLAUDE.md rule 8: flat colours only, no gradient, pattern or shadow blur.
const flatProperties = [
  'createLinearGradient',
  'createRadialGradient',
  'createConicGradient',
  'createPattern',
].map((property) => ({ property, message: 'Flat colours only (SPEC 3.3.3).' }))
const flatSyntax = ['shadowBlur', 'shadowColor', 'filter'].map((name) => ({
  selector: `AssignmentExpression > MemberExpression.left[property.name='${name}']`,
  message: 'Flat colours only (SPEC 3.3.3).',
}))

// CLAUDE.md conventions: interface texts without em dash.
const emDashSyntax = [
  { selector: 'Literal[value=/—/]', message: "Pas de tiret cadratin dans l'interface." },
  {
    selector: 'TemplateElement[value.raw=/—/]',
    message: "Pas de tiret cadratin dans l'interface.",
  },
  { selector: 'JSXText[value=/—/]', message: "Pas de tiret cadratin dans l'interface." },
]

const nodeImports = {
  patterns: [{ group: ['node:*'], message: 'No Node API in application code.' }],
}

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'test-results', 'playwright-report', 'node_modules']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': 'allow-with-description', 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['src/ui/**/*.tsx'],
    extends: [reactRefresh.configs.vite],
  },
  {
    files: ['src/model/**/*.ts', 'src/engine/**/*.ts', 'src/config/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error', ...clockProperties],
      'no-restricted-syntax': ['error', ...clockSyntax],
      'no-restricted-globals': ['error', ...pureGlobals],
      'no-restricted-imports': ['error', pureImports],
    },
  },
  {
    files: ['src/render/**/*.ts', 'src/field/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error', ...clockProperties, ...flatProperties],
      'no-restricted-syntax': ['error', ...clockSyntax, ...flatSyntax],
      'no-restricted-globals': ['error', ...pureGlobals],
      'no-restricted-imports': ['error', pureImports],
    },
  },
  {
    files: ['src/editor/**/*.ts', 'src/player/**/*.ts', 'src/io/**/*.ts', 'src/state/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-imports': ['error', nodeImports] },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', nodeImports],
      'no-restricted-syntax': ['error', ...emDashSyntax],
    },
  },
  {
    files: ['**/*.js', 'e2e/**/*.ts', '*.config.ts', 'src/test/**/*.ts', 'src/**/*.test.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
)
