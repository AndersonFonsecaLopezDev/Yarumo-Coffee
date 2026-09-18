import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const roles = ['owner', 'manager', 'staff'] as const

async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', status: 401 as const }
  const { data: profile } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).maybeSingle()
  const userRole = (profile?.role || '').toLowerCase()
  if (!profile || !['owner', 'manager'].includes(userRole)) return { error: 'No autorizado', status: 403 as const }
  return { user, role: userRole as typeof roles[number], supabase, admin: createAdminClient() }
}

function canAssignRole(currentRole: typeof roles[number], targetRole: string) {
  return currentRole === 'owner' || targetRole !== 'owner'
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export async function GET() {
  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    // Use admin client for both queries:
    // - listUsers() requires admin auth
    // - staff_profiles RLS only allows each user to read their own row,
    //   so we must use the service-role client to fetch ALL profiles.
    const [{ data: authUsers, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
      auth.admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      auth.admin.from('staff_profiles').select('user_id,display_name,role,created_at'),
    ])
    if (usersError || profilesError) return NextResponse.json({ error: usersError?.message || profilesError?.message }, { status: 500 })
    const profileMap = new Map((profiles || []).map(profile => [profile.user_id, { ...profile, role: (profile.role || '').toLowerCase() }]))
    return NextResponse.json((authUsers.users || []).map(user => ({ id: user.id, email: user.email, lastSignInAt: user.last_sign_in_at, profile: profileMap.get(user.id) || null })))
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json() as { email?: string; password?: string; displayName?: string; role?: string }
    const role = (body.role || '').trim().toLowerCase()
    if (!body.email || !body.password || !body.displayName || !role || !roles.includes(role as typeof roles[number]) || body.password.length < 10) return NextResponse.json({ error: 'Email, nombre, rol y contraseña de mínimo 10 caracteres son obligatorios' }, { status: 400 })
    if (!canAssignRole(auth.role, role)) return NextResponse.json({ error: 'Solo un owner puede asignar el rol owner' }, { status: 403 })
    const created = await auth.admin.auth.admin.createUser({ email: body.email.trim().toLowerCase(), password: body.password, email_confirm: true, user_metadata: { display_name: body.displayName.trim() } })
    if (created.error || !created.data.user) return NextResponse.json({ error: created.error?.message || 'No se pudo crear el usuario' }, { status: 400 })
    const { error: profileError } = await auth.admin.from('staff_profiles').insert({ user_id: created.data.user.id, display_name: body.displayName.trim(), role })
    if (profileError) { await auth.admin.auth.admin.deleteUser(created.data.user.id); return NextResponse.json({ error: profileError.message }, { status: 400 }) }
    return NextResponse.json({ id: created.data.user.id }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json() as { id?: string; displayName?: string; role?: string; password?: string }
    const role = (body.role || '').trim().toLowerCase()
    if (!body.id || !body.displayName || !role || !roles.includes(role as typeof roles[number])) return NextResponse.json({ error: 'Datos de usuario incompletos' }, { status: 400 })
    if (!canAssignRole(auth.role, role)) return NextResponse.json({ error: 'Solo un owner puede asignar el rol owner' }, { status: 403 })
    if (body.id === auth.user.id && auth.role === 'owner' && role !== 'owner') return NextResponse.json({ error: 'No puedes quitarte tu propio rol de owner' }, { status: 400 })
    if (auth.role !== 'owner') {
      const { data: target } = await auth.admin.from('staff_profiles').select('role').eq('user_id', body.id).maybeSingle()
      if (target?.role === 'owner') return NextResponse.json({ error: 'Solo un owner puede modificar otro owner' }, { status: 403 })
    }
    const update: { user_metadata: { display_name: string }; password?: string } = { user_metadata: { display_name: body.displayName.trim() } }
    if (body.password) { if (body.password.length < 10) return NextResponse.json({ error: 'La contraseña debe tener mínimo 10 caracteres' }, { status: 400 }); update.password = body.password }
    const changed = await auth.admin.auth.admin.updateUserById(body.id, update)
    if (changed.error) return NextResponse.json({ error: changed.error.message }, { status: 400 })
    const { error } = await auth.admin.from('staff_profiles').update({ display_name: body.displayName.trim(), role }).eq('user_id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  try {
    const auth = await authorize(); if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const id = new URL(request.url).searchParams.get('id')
    if (!id || id === auth.user.id) return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
    if (auth.role !== 'owner') {
      const { data: target } = await auth.admin.from('staff_profiles').select('role').eq('user_id', id).maybeSingle()
      if (target?.role === 'owner') return NextResponse.json({ error: 'Solo un owner puede eliminar otro owner' }, { status: 403 })
    }
    const deleted = await auth.admin.auth.admin.deleteUser(id)
    if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 }) }
}
