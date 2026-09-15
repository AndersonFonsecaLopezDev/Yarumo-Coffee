import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next') ?? '/staff'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/staff'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const publicUrl = process.env.NEXT_PUBLIC_APP_URL || origin
      return NextResponse.redirect(new URL(next, publicUrl))
    }
  }

  return NextResponse.redirect(`${origin}/staff?error=oauth_error`)
}
