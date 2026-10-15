import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// SPEC 3.4: the base path must match the repository name exactly (case sensitive).
export default defineConfig({
  base: '/Abla_rckF7_tac/',
  plugins: [react()],
  build: {
    target: 'es2023',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
