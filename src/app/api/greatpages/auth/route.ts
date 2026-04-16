/**
 * GET /api/greatpages/auth?empresa_id=xxx
 *
 * Auto-conexão do GreatPages via CRM BGPGO.
 * Requer que o CRM já esteja conectado para a empresa.
 *
 * Não há OAuth — os dados vêm do CRM via webhook (UTM tracking).
 *
 * Query params:
 *   empresa_id — UUID da empresa (obrigatório)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectGreatPagesAuto } from '@/lib/drivers/greatpages'

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id')

  if (!empresaId) {
    return NextResponse.json(
      { error: 'empresa_id obrigatório' },
      { status: 400 }
    )
  }

  // Verifica autenticação
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    await connectGreatPagesAuto(empresaId, user.id)

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host}`

    return NextResponse.redirect(
      `${appUrl}/conexoes?connected=greatpages&empresa=${empresaId}`
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao conectar GreatPages'

    // Se o erro for "CRM não conectado", retorna 409 com instrução
    const status = message.includes('CRM BGPGO') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
