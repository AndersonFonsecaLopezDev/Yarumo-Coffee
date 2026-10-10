'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Invalida las etiquetas y rutas del menú público tras mutaciones en el panel de staff.
 * Solo puede ser ejecutada por usuarios autenticados con rol de staff.
 */
export async function revalidatePublicContent(tags: string[] = ['menu', 'categories', 'promotions', 'settings']) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'No autorizado' }
    }

    // Comprobar rol de staff
    const { data: isStaff } = await supabase.rpc('is_staff')
    if (!isStaff) {
      return { error: 'Permisos insuficientes' }
    }

    for (const tag of tags) {
      revalidateTag(tag, { expire: 0 })
    }
    revalidatePath('/')
    revalidatePath('/recomendaciones')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al revalidar' }
  }
}
