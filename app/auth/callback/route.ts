import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site-url'

function isEmailAuthorizedForStaff(email?: string | null): boolean {
  if (!email) return false
  const allowed = process.env.STAFF_ALLOWED_EMAIL_DOMAIN || process.env.STAFF_ALLOWED_EMAILS || ''
  const rules = allowed.split(',').map(r => r.trim().toLowerCase()).filter(Boolean)
  if (!rules.length) {
    return false
  }
  const cleanEmail = email.trim().toLowerCase()
  return rules.some(rule => {
    if (rule.includes('@')) {
      return cleanEmail === rule
    }
    const cleanDomain = rule.startsWith('@') ? rule.slice(1) : rule
    return cleanEmail.endsWith(`@${cleanDomain}`)
  })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin || SITE_URL
  const code = requestUrl.searchParams.get('code')
  const requestedNext = requestUrl.searchParams.get('next') ?? '/staff'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/staff'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Verificar si el usuario autenticado tiene perfil en staff_profiles
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('staff_profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!profile) {
          if (!isEmailAuthorizedForStaff(user.email)) {
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/staff?error=not_authorized', origin))
          }

          const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario Staff'
          try {
            const admin = createAdminClient()
            await admin.from('staff_profiles').insert({
              user_id: user.id,
              display_name: displayName,
              role: 'staff',
            })
          } catch {
            // Si no se puede usar el cliente admin, intentar con el cliente de usuario
            await supabase.from('staff_profiles').insert({
              user_id: user.id,
              display_name: displayName,
              role: 'staff',
            })
          }
        }
      }
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL('/staff?error=oauth_error', origin))
}

