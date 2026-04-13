import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Extract the ngrok origin so all /webhook/* requests can be proxied.
  // Falls back to localhost n8n if the env var is missing or still a placeholder.
  let ngrokOrigin = 'http://localhost:5678'
  try {
    const parsed = new URL(env.VITE_N8N_WEBHOOK_URL || '')
    if (parsed.hostname && !parsed.hostname.includes('https://psychotropic-pliantly-gaynelle.ngrok-free.dev')) {
      ngrokOrigin = parsed.origin
    }
  } catch {}

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Route all /webhook/* calls through the dev server to avoid browser CORS.
        // Both n8n webhooks share the same ngrok origin but different paths.
        '/webhook': {
          target: ngrokOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
