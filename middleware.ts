import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Si la petición llega a la raíz con errores de autenticación de Supabase (OAuth), redirigir directamente al panel de staff
  if (
    request.nextUrl.pathname === '/' &&
    (request.nextUrl.searchParams.has('error') || request.nextUrl.searchParams.has('error_code'))
  ) {
    const staffUrl = new URL('/staff', request.url)
    staffUrl.search = request.nextUrl.search
    return NextResponse.redirect(staffUrl)
  }

  const response = NextResponse.next({ request })

  if (request.nextUrl.pathname.startsWith('/staff')) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => { response.cookies.set(name, value, options) }) },
    })
    await supabase.auth.getUser()
  }

  // The page renders the login form when there is no session. Database RLS remains the authority.
  return response
}

export const config = { matcher: ['/', '/staff/:path*'] }
