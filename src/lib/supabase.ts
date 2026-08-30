import { createClient } from '@supabase/supabase-js'

const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// IMPORTANTE (bloqueos de LaLiga a Cloudflare en España):
// Supabase va por Cloudflare, así que NO llamamos a *.supabase.co directamente.
// El cliente habla siempre con el MISMO origen de la app, en la ruta /sb, que el
// host (Vercel / VPS / vite dev) redirige (proxy) hacia el proyecto Supabase.
// Así, durante los partidos, el navegador nunca toca una IP de Cloudflare.
const proxyBase =
  typeof window !== 'undefined' ? `${window.location.origin}/sb` : '/sb'

if (!anon) {
  console.warn(
    '[porra] Falta VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y rellénala.',
  )
}

export const supabase = createClient(proxyBase, anon ?? '', {
  db: { schema: 'porra' },
  auth: {
    // Clave de sesión FIJA (independiente del dominio), para que un cambio de
    // dominio no cierre la sesión de todos.
    storageKey: 'porra-fantasy-auth',
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const hasSupabase = Boolean(anon)
