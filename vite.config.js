import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function parivaarApiPlugin() {
  const middleware = async (req, res, next) => {
    if (req.url && req.url.startsWith('/api/parivaar')) {
      try {
        const { handleParivaarApiRequest } = await import('./server/parivaarApiHandler.mjs')
        await handleParivaarApiRequest(req, res)
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            ok: false,
            code: 'SERVER_ERROR',
            message: err?.message || 'Internal API error',
          })
        )
      }
      return
    }
    next()
  }
  return {
    name: 'parivaar-database-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), parivaarApiPlugin()],
  server: {
    // Bind to all interfaces so the sandbox preview is reachable.
    host: true,
    // Allow the *.e2b.app preview host (Vite blocks unknown hosts by default).
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
