import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Si la petición llega a la raíz con errores de autenticación de Supabase, redirigir al panel de staff
  if (
    request.nextUrl.pathname === '/' &&
    (request.nextUrl.searchParams.has('error') || request.nextUrl.searchParams.has('error_code'))
  ) {
    const staffUrl = new URL('/staff', request.url)
    staffUrl.search = request.nextUrl.search
    return NextResponse.redirect(staffUrl)
  }

  // Si la petición llega a la raíz con código o token de autenticación por correo (PKCE, enlace mágico o confirmación),
  // redirigir al callback de autenticación para intercambiar sesión y acceder a /staff
  if (
    request.nextUrl.pathname === '/' &&
    (request.nextUrl.searchParams.has('code') || request.nextUrl.searchParams.has('token_hash'))
  ) {
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.search = request.nextUrl.search
    if (!callbackUrl.searchParams.has('next')) {
      callbackUrl.searchParams.set('next', '/staff')
    }
    return NextResponse.redirect(callbackUrl)
  }

  const response = NextResponse.next({ request })

  if (
    request.nextUrl.pathname.startsWith('/staff') &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => { response.cookies.set(name, value, options) }) },
    })
    await supabase.auth.getUser()
  }

  // The page renders the login form when there is no session. Database RLS remains the authority.
  return response
}

export const config = { matcher: ['/', '/staff/:path*'] }
