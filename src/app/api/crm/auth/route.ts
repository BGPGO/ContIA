/**
 * GET /api/crm/auth?empresa_id=xxx
 *
 * Auto-conexão do CRM BGPGO — não há OAuth neste provider.
 * Cria ou atualiza a linha em social_connections e redireciona para /conexoes.
 *
 * Query params:
 *   empresa_id — UUID da empresa (obrigatório)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectCrmAuto } from '@/lib/drivers/crm'

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
    await connectCrmAuto(empresaId, user.id)

    // Redireciona de volta para /conexoes com flag de sucesso
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host}`

    return NextResponse.redirect(
      `${appUrl}/conexoes?connected=crm&empresa=${empresaId}`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar CRM'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
