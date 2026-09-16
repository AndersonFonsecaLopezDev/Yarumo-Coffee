import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next') ?? '/staff'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/staff'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, SITE_URL))
    }
  }

  return NextResponse.redirect(new URL('/staff?error=oauth_error', SITE_URL))
}
