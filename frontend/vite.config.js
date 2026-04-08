import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Backend default port — keep in sync with backend/server.js (PORT || 3001) */
const API_PORT = process.env.VITE_API_PORT || '3001'
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
        configure(proxy) {
          let warned = false
          proxy.on('error', (err) => {
            if (warned) return
            if (err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')) {
              warned = true
              console.warn(
                `\n[Vite] Cannot proxy /api to ${API_ORIGIN}. Start the API first:\n` +
                  `  • From repo root: npm run dev   (starts backend + frontend)\n` +
                  `  • Or: cd backend && npm run dev\n`
              )
            }
          })
        },
      },
    },
  },
})
