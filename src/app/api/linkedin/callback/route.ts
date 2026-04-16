import { NextRequest, NextResponse } from 'next/server'
import { linkedinDriver } from '@/lib/drivers/linkedin'

export const runtime = 'nodejs'

/**
 * GET /api/linkedin/callback?code=xxx&state=xxx
 *
 * Callback OAuth do LinkedIn.
 * Troca o authorization code pelo access_token,
 * busca o perfil via /userinfo e salva a conexão no banco.
 *
 * Em caso de erro, redireciona para /conexoes?error=<código>.
 * Em caso de sucesso, redireciona para /conexoes?success=linkedin.
 */
export async function GET(req: NextRequest) {
  const origin =
    process.env.APP_URL ||
    `${req.headers.get('x-forwarded-proto') ?? 'https'}://${
      req.headers.get('x-forwarded-host') ??
      req.headers.get('host') ??
      req.nextUrl.host
    }`

  const code = req.nextUrl.searchParams.get('code')
  const stateParam = req.nextUrl.searchParams.get('state')

  // LinkedIn envia error e error_description quando usuário nega acesso
  const errorParam = req.nextUrl.searchParams.get('error')
  const errorDescription = req.nextUrl.searchParams.get('error_description')

  if (errorParam) {
    const detail = encodeURIComponent(errorDescription ?? errorParam)
    return NextResponse.redirect(
      new URL(`/conexoes?error=access_denied&detail=${detail}`, origin)
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/conexoes?error=missing_params', origin)
    )
  }

  try {
    const connection = await linkedinDriver.handleCallback(code, stateParam)

    const displayName = encodeURIComponent(connection.display_name ?? 'LinkedIn')
    return NextResponse.redirect(
      new URL(
        `/conexoes?success=linkedin&name=${displayName}`,
        origin
      )
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[LinkedIn Callback]', message)

    // Verifica se é erro de state inválido (possível CSRF)
    if (message.includes('State inválido')) {
      return NextResponse.redirect(
        new URL('/conexoes?error=invalid_state', origin)
      )
    }

    const detail = encodeURIComponent(message.slice(0, 200))
    return NextResponse.redirect(
      new URL(`/conexoes?error=auth_failed&detail=${detail}`, origin)
    )
  }
}
