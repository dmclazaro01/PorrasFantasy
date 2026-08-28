import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // No rompemos la app en modo demo, pero avisamos claramente.
  console.warn(
    '[porra] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env.local y rellena tus claves de Supabase.',
  )
}

export const supabase = createClient(url ?? '', anon ?? '', {
  // Toda la app vive en el schema `porra` (aislado del resto del proyecto).
  db: { schema: 'porra' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const hasSupabase = Boolean(url && anon)
