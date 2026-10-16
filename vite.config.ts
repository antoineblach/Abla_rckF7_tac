import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// D-071: jsPDF imports html2canvas, dompurify and canvg on demand, for features the exports never
// use; an empty module stands for them, so that they stay out of the build.
const emptyModule = fileURLToPath(new URL('./src/export/worker/emptyModule.ts', import.meta.url))

// SPEC 3.4: the base path must match the repository name exactly (case sensitive).
export default defineConfig({
  base: '/Abla_rckF7_tac/',
  plugins: [react()],
  resolve: {
    alias: { html2canvas: emptyModule, dompurify: emptyModule, canvg: emptyModule },
  },
  // The export worker is a module worker (jsPDF and gifenc are loaded there only).
  worker: { format: 'es' },
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
