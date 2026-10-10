import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPersistentRateLimit } from '@/lib/rate-limit'

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener recomendaciones' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || 'anon-client'

    const body = await request.json()
    const { name, rating, comment, tableNumber } = body

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

    if (tableNumber) {
      const cleanTable = String(tableNumber).trim()
      const { data: recentTableRec } = await supabase
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

    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        name: name.trim(),
        rating: numRating,
        comment: comment.trim(),
        table_number: tableNumber ? String(tableNumber).trim() : null,
        status: 'pending',
      })
      .select()
      .single()


    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    )
  }
}
