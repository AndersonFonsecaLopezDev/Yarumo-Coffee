import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

/**
 * Cliente anónimo estático sin acceso a cookies.
 * Permite que las consultas de lectura pública (menú, categorías, promociones, ajustes)
 * se ejecuten en Server Components sin forzar render dinámico, habilitando ISR estático.
 */
export function createPublicClient() {
  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
