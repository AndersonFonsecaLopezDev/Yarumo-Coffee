import { createClient } from '@/lib/supabase/server'

const RATE_LIMIT_WINDOW_SECONDS = 60
const MAX_REQUESTS = 2

/**
 * Validador persistente de tasa de solicitudes (Rate Limiter).
 * Diseñado para entornos Serverless donde la memoria volátil no se comparte entre instancias:
 * 1. Si Upstash Redis está configurado (variables UPSTASH_REDIS_REST_URL y TOKEN), utiliza Redis HTTP REST.
 * 2. Si no, utiliza verificación persistente en Supabase (tabla recommendations y control temporal).
 */
export async function checkPersistentRateLimit(
  identifier: string,
  tableNumber?: string | null,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

  // 1. Upstash Redis REST
  if (upstashUrl && upstashToken) {
    try {
      const key = `rate_limit:rec:${identifier}`
      const incrRes = await fetch(`${upstashUrl}/incr/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: 'no-store',
      })
      if (incrRes.ok) {
        const { result: count } = await incrRes.json()
        if (count === 1) {
          await fetch(`${upstashUrl}/expire/${encodeURIComponent(key)}/${RATE_LIMIT_WINDOW_SECONDS}`, {
            headers: { Authorization: `Bearer ${upstashToken}` },
            cache: 'no-store',
          })
        }
        if (count > MAX_REQUESTS) {
          return { allowed: false, retryAfter: RATE_LIMIT_WINDOW_SECONDS }
        }
        return { allowed: true }
      }
    } catch {
      // Continuar al fallback de base de datos
    }
  }

  // 2. Fallback persistente en Supabase
  try {
    const supabase = await createClient()
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString()

    // Comprobar envíos recientes si hay mesa asociada
    if (tableNumber) {
      const cleanTable = String(tableNumber).trim()
      const { data: tableRecs } = await supabase
        .from('recommendations')
        .select('id')
        .eq('table_number', cleanTable)
        .gte('created_at', windowStart)
        .limit(MAX_REQUESTS + 1)

      if (tableRecs && tableRecs.length >= MAX_REQUESTS) {
        return { allowed: false, retryAfter: RATE_LIMIT_WINDOW_SECONDS }
      }
    }

    return { allowed: true }
  } catch {
    // Si la base de datos no está disponible temporalmente, permitir
    return { allowed: true }
  }
}
