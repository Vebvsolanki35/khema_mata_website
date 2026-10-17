import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
