import { defineConfig } from 'vite'

// COOP/COEP enable cross-origin isolation → SharedArrayBuffer → OPFS VFS for sqlite-wasm.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  server: {
    port: 5173,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  build: { target: 'es2022' },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
})
