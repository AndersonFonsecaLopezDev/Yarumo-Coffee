'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Invalida las rutas del menú público tras mutaciones en el panel de staff.
 * Solo puede ser ejecutada por usuarios autenticados con rol de staff.
 */
export async function revalidatePublicContent(_tags: string[] = ['menu', 'categories', 'promotions', 'settings']) {
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
    void _tags
    revalidatePath('/', 'layout')
    revalidatePath('/')
    revalidatePath('/recomendaciones')
    revalidatePath('/producto/[id]', 'page')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al revalidar' }
  }
}
