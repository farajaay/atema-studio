import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/atema-studio/',
  build: {
    // Public bundle currently 596 KB raw / 169 KB gzip after admin
    // code-split (Patch M-2). 800 KB silences the rollup warning until
    // there's a real reason to investigate further growth.
    chunkSizeWarningLimit: 800,
  },
})
