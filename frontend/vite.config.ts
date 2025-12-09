// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build identifier used to detect when a new deployment is live
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.SOURCE_VERSION ||
  process.env.COMMIT_SHA ||
  new Date().toISOString()

// Emit a small JSON file with build metadata so the client can poll for updates
const buildMetaPlugin = () => ({
  name: 'build-meta',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'build-meta.json',
      source: JSON.stringify({ buildId, builtAt: new Date().toISOString() }),
    })
  },
})

export default defineConfig({
  plugins: [react(), buildMetaPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  // No proxy needed for production
})
