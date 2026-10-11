import { createClient } from '@/lib/supabase/server'

const RATE_LIMIT_WINDOW_SECONDS = 60
const MAX_REQUESTS = 2

// Memoria volátil de respaldo por proceso serverless
type MemoryEntry = { count: number; resetAt: number }
const inMemoryCache = new Map<string, MemoryEntry>()

/**
 * Extrae la dirección IP del cliente de forma segura frente a spoofing de headers:
 * 1. Prioriza 'x-real-ip' o 'x-vercel-forwarded-for' fijados de forma no manipulable por los proxies de Vercel/Cloudflare.
 * 2. Si solo existe 'x-forwarded-for', toma el primer salto y descarta valores no válidos.
 */
export function extractClientIp(headers: Headers): string {
  const directRealIp = headers.get('x-real-ip') || headers.get('x-vercel-forwarded-for')
  if (directRealIp) {
    return directRealIp.trim()
  }

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const candidate = forwarded.split(',')[0]?.trim()
    if (candidate && candidate.length <= 45) {
      return candidate
    }
  }

  return '127.0.0.1'
}

type RateLimitOptions = {
  policy?: 'fail-open' | 'fail-closed'
}

/**
 * Validador persistente de tasa de solicitudes (Rate Limiter).
 * Diseñado para entornos Serverless:
 * 1. Upstash Redis REST si UPSTASH_REDIS_REST_URL y TOKEN están configurados.
 * 2. Supabase si hay mesa asociada.
 * 3. In-memory con TTL como salvaguarda ante ráfagas en la misma instancia.
 */
export async function checkPersistentRateLimit(
  identifier: string,
  tableNumber?: string | null,
  options: RateLimitOptions = { policy: 'fail-open' },
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
        const { result: count } = (await incrRes.json()) as { result: number }
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

    // 3. Fallback en memoria volátil si no hay mesa ni Upstash
    const now = Date.now()
    const existing = inMemoryCache.get(identifier)

    if (existing && existing.resetAt > now) {
      if (existing.count >= MAX_REQUESTS) {
        return {
          allowed: false,
          retryAfter: Math.ceil((existing.resetAt - now) / 1000),
        }
      }
      existing.count += 1
    } else {
      inMemoryCache.set(identifier, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
      })
    }

    return { allowed: true }
  } catch {
    // Si la infraestructura falla, responder según política
    if (options.policy === 'fail-closed') {
      return { allowed: false, retryAfter: RATE_LIMIT_WINDOW_SECONDS }
    }
    return { allowed: true }
  }
}
