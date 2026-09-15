import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => { response.cookies.set(name, value, options) }) },
  })
  await supabase.auth.getUser()
  // The page renders the login form when there is no session. Database RLS remains the authority.
  return response
}

export const config = { matcher: ['/staff/:path*'] }
