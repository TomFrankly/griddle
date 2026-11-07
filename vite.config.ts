import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'

// Send feedback in `npm run dev`: the Worker's handler, with the Notion secrets taken from
// the environment (export NOTION_FEEDBACK_TOKEN and NOTION_FEEDBACK_DATA_SOURCE_ID to try it).
const feedbackApi = (): Plugin => ({
  name: 'griddle-feedback-api',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/feedback', async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const origin = `http://${req.headers.host}`
      const request = new Request(origin + '/api/feedback', {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
      })
      const { handleFeedback } = await server.ssrLoadModule('/worker/feedback.ts')
      const response: Response = await handleFeedback(request, process.env, 'local')
      res.statusCode = response.status
      res.setHeader('Content-Type', 'application/json')
      res.end(await response.text())
    })
  },
})

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
  plugins: [tailwindcss(), svelte(), versionFile(), feedbackApi()],
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
  resolve: {
    alias: { $lib: path.resolve('./src/lib') },
  },
})
