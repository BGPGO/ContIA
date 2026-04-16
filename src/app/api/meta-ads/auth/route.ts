import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { metaAdsDriver } from '@/lib/drivers/meta_ads'

export const runtime = 'nodejs'

/**
 * GET /api/meta-ads/auth?empresa_id=xxx
 * Inicia o fluxo OAuth para Meta Ads (Facebook/Instagram Ads).
 * Redireciona para o Facebook Login com scopes de ads_read.
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
    const authUrl = await metaAdsDriver.buildAuthUrl(empresaId, user.id)
    return NextResponse.redirect(authUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Meta Ads Auth] Erro ao montar URL OAuth:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
