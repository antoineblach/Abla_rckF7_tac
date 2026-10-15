import { defineConfig, devices } from '@playwright/test'

const port = 4173
const isCi = Boolean(process.env.CI)

// End-to-end tests run against the production build served by `vite preview`.
// Files named *.chromium.spec.ts run in Chromium only (folder mode),
// *.firefox.spec.ts in Firefox only (degraded mode), other specs in both.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}/Abla_rckF7_tac/`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /\.firefox\.spec\.ts$/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
      testIgnore: /\.chromium\.spec\.ts$/,
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/Abla_rckF7_tac/`,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
})
