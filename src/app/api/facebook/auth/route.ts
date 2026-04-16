import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { facebookDriver } from '@/lib/drivers/facebook'

export const runtime = 'nodejs'

/**
 * GET /api/facebook/auth?empresa_id=xxx
 * Inicia o fluxo OAuth para Facebook Pages.
 * Redireciona o usuário para o Facebook Login (mesmo Meta App do Instagram).
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id')
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  // Verificar autenticação
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const authUrl = await facebookDriver.buildAuthUrl(empresaId, user.id)
    return NextResponse.redirect(authUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Facebook Auth] Erro ao montar URL OAuth:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
