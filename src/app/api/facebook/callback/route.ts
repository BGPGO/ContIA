import { NextRequest, NextResponse } from 'next/server'
import { facebookDriver } from '@/lib/drivers/facebook'

export const runtime = 'nodejs'

/**
 * GET /api/facebook/callback?code=xxx&state=xxx
 * Callback OAuth do Facebook.
 * Troca o code por tokens, captura o page access_token e persiste a conexão.
 */
export async function GET(req: NextRequest) {
  const origin =
    process.env.APP_URL ||
    `${req.headers.get('x-forwarded-proto') || 'https'}://${
      req.headers.get('x-forwarded-host') ||
      req.headers.get('host') ||
      req.nextUrl.host
    }`

  const code = req.nextUrl.searchParams.get('code')
  const stateParam = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  // Usuário negou acesso
  if (errorParam) {
    return NextResponse.redirect(new URL('/conexoes?error=access_denied', origin))
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/conexoes?error=missing_params', origin))
  }

  try {
    const connection = await facebookDriver.handleCallback(code, stateParam)

    const pageName = encodeURIComponent(connection.display_name ?? connection.username ?? '')
    return NextResponse.redirect(
      new URL(`/conexoes?connected=facebook&page=${pageName}`, origin)
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Facebook Callback] Erro:', msg)
    const detail = encodeURIComponent(msg.slice(0, 200))
    return NextResponse.redirect(
      new URL(`/conexoes?error=auth_failed&detail=${detail}`, origin)
    )
  }
}
