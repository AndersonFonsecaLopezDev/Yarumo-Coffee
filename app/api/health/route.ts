import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('menu_items').select('id', { count: 'exact', head: true }).limit(1)

    if (error) {
      // No exponemos el mensaje crudo de Postgres/Supabase: solo una etiqueta genérica.
      return NextResponse.json(
        { ok: false, service: 'yarumo-coffee', timestamp, error: 'database_unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      { ok: true, service: 'yarumo-coffee', timestamp },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { ok: false, service: 'yarumo-coffee', timestamp, error: 'database_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
