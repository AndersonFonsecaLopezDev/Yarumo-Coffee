import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const roles = ['owner', 'manager', 'staff'] as const

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
})

const CreateUserSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(100),
  displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  role: z.enum(roles, { message: 'El rol debe ser owner, manager o staff' }),
})

const UpdateUserSchema = z.object({
  id: z.string().uuid('ID de usuario inválido'),
  displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  role: z.enum(roles, { message: 'El rol debe ser owner, manager o staff' }),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(100).optional(),
})

const DeleteUserSchema = z.object({
  id: z.string().uuid('ID de usuario inválido'),
})

async function authorize() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', status: 401 as const }

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const userRole = (profile?.role || '').toLowerCase()
  if (!profile || !['owner', 'manager'].includes(userRole)) {
    return { error: 'No autorizado', status: 403 as const }
  }

  return { user, role: userRole as (typeof roles)[number], supabase, admin: createAdminClient() }
}

function canAssignRole(currentRole: (typeof roles)[number], targetRole: string) {
  return currentRole === 'owner' || targetRole !== 'owner'
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const url = new URL(request.url)
    const queryParsed = PaginationQuerySchema.safeParse({
      page: url.searchParams.get('page') || undefined,
      perPage: url.searchParams.get('perPage') || undefined,
    })

    if (!queryParsed.success) {
      return NextResponse.json({ error: 'Parámetros de paginación inválidos' }, { status: 400 })
    }

    const { page, perPage } = queryParsed.data

    const [{ data: authUsers, error: usersError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        auth.admin.auth.admin.listUsers({ page, perPage }),
        auth.admin.from('staff_profiles').select('user_id,display_name,role,created_at'),
      ])

    if (usersError || profilesError) {
      return NextResponse.json(
        { error: 'Error al consultar usuarios del sistema' },
        { status: 500 },
      )
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.user_id,
        { ...profile, role: (profile.role || '').toLowerCase() },
      ]),
    )

    const users = (authUsers.users || []).map((user) => ({
      id: user.id,
      email: user.email,
      lastSignInAt: user.last_sign_in_at,
      profile: profileMap.get(user.id) || null,
    }))

    return NextResponse.json(users)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  }

  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const rawBody = await request.json()
    const parsed = CreateUserSchema.safeParse(rawBody)

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Datos de usuario inválidos'
      return NextResponse.json({ error: firstIssue }, { status: 400 })
    }

    const { email, password, displayName, role } = parsed.data

    if (!canAssignRole(auth.role, role)) {
      return NextResponse.json({ error: 'Solo un owner puede asignar el rol owner' }, { status: 403 })
    }

    const created = await auth.admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName.trim() },
    })

    if (created.error || !created.data.user) {
      return NextResponse.json(
        { error: created.error?.message || 'No se pudo crear el usuario' },
        { status: 400 },
      )
    }

    const { error: profileError } = await auth.admin.from('staff_profiles').insert({
      user_id: created.data.user.id,
      display_name: displayName.trim(),
      role,
    })

    if (profileError) {
      await auth.admin.auth.admin.deleteUser(created.data.user.id)
      return NextResponse.json({ error: 'No se pudo configurar el perfil del usuario' }, { status: 400 })
    }

    return NextResponse.json({ id: created.data.user.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  }

  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const rawBody = await request.json()
    const parsed = UpdateUserSchema.safeParse(rawBody)

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Datos de usuario inválidos'
      return NextResponse.json({ error: firstIssue }, { status: 400 })
    }

    const { id, displayName, role, password } = parsed.data

    if (!canAssignRole(auth.role, role)) {
      return NextResponse.json({ error: 'Solo un owner puede asignar el rol owner' }, { status: 403 })
    }

    if (id === auth.user.id && auth.role === 'owner' && role !== 'owner') {
      return NextResponse.json({ error: 'No puedes quitarte tu propio rol de owner' }, { status: 400 })
    }

    if (auth.role !== 'owner') {
      const { data: target } = await auth.admin
        .from('staff_profiles')
        .select('role')
        .eq('user_id', id)
        .maybeSingle()

      if (target?.role === 'owner') {
        return NextResponse.json({ error: 'Solo un owner puede modificar otro owner' }, { status: 403 })
      }
      if (auth.role === 'manager' && target?.role === 'manager' && id !== auth.user.id) {
        return NextResponse.json({ error: 'Un manager no puede modificar a otro manager' }, { status: 403 })
      }
    }

    const update: { user_metadata: { display_name: string }; password?: string } = {
      user_metadata: { display_name: displayName.trim() },
    }

    if (password) {
      update.password = password
    }

    const changed = await auth.admin.auth.admin.updateUserById(id, update)
    if (changed.error) {
      return NextResponse.json({ error: changed.error.message }, { status: 400 })
    }

    const { error: profileUpdateError } = await auth.admin
      .from('staff_profiles')
      .update({ display_name: displayName.trim(), role })
      .eq('user_id', id)

    if (profileUpdateError) {
      return NextResponse.json({ error: 'No se pudo actualizar el perfil' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  }

  try {
    const auth = await authorize()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const rawId = new URL(request.url).searchParams.get('id')
    const parsed = DeleteUserSchema.safeParse({ id: rawId })

    if (!parsed.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 })
    }

    const { id } = parsed.data

    if (id === auth.user.id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
    }

    if (auth.role !== 'owner') {
      const { data: target } = await auth.admin
        .from('staff_profiles')
        .select('role')
        .eq('user_id', id)
        .maybeSingle()

      if (target?.role === 'owner') {
        return NextResponse.json({ error: 'Solo un owner puede eliminar otro owner' }, { status: 403 })
      }
      if (auth.role === 'manager' && target?.role === 'manager') {
        return NextResponse.json({ error: 'Un manager no puede eliminar a otro manager' }, { status: 403 })
      }
    }

    // Limpiar perfil y luego usuario en Supabase Auth
    await auth.admin.from('staff_profiles').delete().eq('user_id', id)
    const deleted = await auth.admin.auth.admin.deleteUser(id)
    if (deleted.error) {
      return NextResponse.json({ error: deleted.error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
