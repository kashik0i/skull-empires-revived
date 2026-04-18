import { defineConfig } from 'vite'
import { devLogPlugin } from './scripts/vite-dev-log'

// COOP/COEP enable cross-origin isolation → SharedArrayBuffer → OPFS VFS for sqlite-wasm.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [devLogPlugin()],
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
