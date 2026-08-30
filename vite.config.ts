import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const supabaseTarget = env.VITE_SUPABASE_URL || 'https://lhbunbxawlbhfcvbkqmf.supabase.co'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      // Proxy local: /sb/* -> Supabase (para que el cliente hable siempre con /sb)
      proxy: {
        '/sb': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/sb/, ''),
        },
      },
    },
  }
})
