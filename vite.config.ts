import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'

// Each build gets an id. The app compares it with /version.json to offer a reload after a deploy.
const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)

const versionFile = (): Plugin => ({
  name: 'griddle-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) })
  },
})

export default defineConfig({
  plugins: [tailwindcss(), svelte(), versionFile()],
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
  resolve: {
    alias: { $lib: path.resolve('./src/lib') },
  },
})
