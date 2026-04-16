import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { linkedinDriver } from '@/lib/drivers/linkedin'

export const runtime = 'nodejs'

/**
 * GET /api/linkedin/auth?empresa_id=xxx
 *
 * Inicia o fluxo OAuth do LinkedIn.
 * Redireciona o usuário para a página de autorização do LinkedIn.
 *
 * Scopes solicitados (Nível 1 — auto-aprovados):
 *   openid, profile, email, w_member_social
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id')
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  // Verificar autenticação Supabase
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (!process.env.LINKEDIN_CLIENT_ID) {
    return NextResponse.json(
      { error: 'LINKEDIN_CLIENT_ID não configurado no servidor' },
      { status: 500 }
    )
  }

  try {
    const oauthUrl = await linkedinDriver.buildAuthUrl(empresaId, user.id)
    return NextResponse.redirect(oauthUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar URL OAuth'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
