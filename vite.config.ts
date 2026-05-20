import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ATEMA STUDIO — production build is hardened so the bundle is unreadable
// without effort. This is **defence-in-depth**, not security: the Supabase
// anon key and the public business logic stay in the bundle by design.
// Real protection lives in RLS + Edge Functions (see docs/MANUAL.md §15).
export default defineConfig({
  plugins: [react()],

  // Custom domain — atemastudio.xyz serves from root. Switch back to
  // '/atema-studio/' only if reverting to the github.io project URL.
  base: '/',

  build: {
    // Use terser instead of esbuild so we can:
    //   - mangle local + top-level names
    //   - strip console.* and debugger statements
    //   - strip every comment
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },

    // No source maps in production — they reveal the original code path.
    sourcemap: false,

    // Public bundle currently 596 KB raw / 169 KB gzip after admin
    // code-split (Patch M-2). 800 KB silences the rollup warning until
    // there's a real reason to investigate further growth.
    chunkSizeWarningLimit: 800,
  },
})
