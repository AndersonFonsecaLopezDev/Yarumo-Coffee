import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkPersistentRateLimit, extractClientIp } from '@/lib/rate-limit'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('recommendations')
      .select('id, name, rating, comment, table_number, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error al consultar recomendaciones:', error)
      Sentry.captureException(error)
      return NextResponse.json(
        { error: 'No se pudieron obtener las recomendaciones en este momento.' },
        { status: 500 },
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Excepción no controlada en GET /api/recommendations:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar las recomendaciones.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers)

    const body = await request.json()
    const { name, rating, comment, tableNumber, website, honeypot } = body

    // Protección antispam: si un bot llena el campo trampa oculto, descartar silenciosamente
    if (website || honeypot) {
      return NextResponse.json({ success: true, message: 'Recomendación recibida.' }, { status: 200 })
    }

    const tableId = tableNumber ? String(tableNumber).trim() : 'general'
    const clientKey = `${ip}:${tableId}`

    const { allowed, retryAfter } = await checkPersistentRateLimit(clientKey, tableNumber)
    if (!allowed) {
      return NextResponse.json(
        { error: `Has enviado varias opiniones recientemente. Por favor espera ${retryAfter || 60} segundos antes de enviar otra.` },
        { status: 429 },
      )
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Ingresa tu nombre (mínimo 2 caracteres).' }, { status: 400 })
    }

    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json({ error: 'Selecciona una calificación entre 1 y 5 estrellas.' }, { status: 400 })
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length < 5) {
      return NextResponse.json({ error: 'Ingresa tu recomendación o comentario (mínimo 5 caracteres).' }, { status: 400 })
    }

    const supabase = await createClient()

    // Preferir cliente con permisos de administración en servidor si la clave de servicio está presente
    let dbClient = supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        dbClient = createAdminClient() as unknown as typeof supabase
      } catch {
        dbClient = supabase
      }
    }

    if (tableNumber) {
      const cleanTable = String(tableNumber).trim()
      const { data: recentTableRec } = await dbClient
        .from('recommendations')
        .select('id')
        .eq('table_number', cleanTable)
        .gte('created_at', new Date(Date.now() - 45 * 1000).toISOString())
        .limit(1)

      if (recentTableRec && recentTableRec.length > 0) {
        return NextResponse.json(
          { error: 'Ya se registró una opinión reciente para esta mesa. Por favor espera unos segundos.' },
          { status: 429 },
        )
      }
    }

    // Insertar sin .select().single() para evitar que PostgreSQL intente evaluar
    // la política RLS de SELECT en una fila recién creada con status 'pending'
    const { error } = await dbClient
      .from('recommendations')
      .insert({
        name: name.trim(),
        rating: numRating,
        comment: comment.trim(),
        table_number: tableNumber ? String(tableNumber).trim() : null,
        status: 'pending',
      })

    if (error) {
      console.error('Error al insertar recomendación:', error)
      return NextResponse.json(
        { error: 'No se pudo registrar tu recomendación en este momento. Por favor intenta de nuevo.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Excepción en POST /api/recommendations:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar la recomendación.' },
      { status: 500 },
    )
  }
}
