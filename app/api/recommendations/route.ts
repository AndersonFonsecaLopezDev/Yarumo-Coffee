import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const body = await request.json()
    const { name, rating, comment, tableNumber } = body

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
