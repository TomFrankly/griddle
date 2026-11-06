// Builds the whole app into one self-contained index.html (used for shareable previews).
import { defineConfig, mergeConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import base from './vite.config'

export default mergeConfig(base, defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-single', assetsInlineLimit: 100_000_000 },
}))
