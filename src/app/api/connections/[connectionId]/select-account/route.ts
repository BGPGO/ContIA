import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import type { Connection } from '@/types/providers'

export const runtime = 'nodejs'

/**
 * POST /api/connections/[connectionId]/select-account
 *
 * Troca a ad account ativa de uma conexão Meta Ads sem precisar reconectar.
 * A conta escolhida deve estar em metadata.available_accounts.
 *
 * Body: { ad_account_id: "act_..." }
 *
 * Retorna a conexão atualizada.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId ausente' }, { status: 400 })
  }

  // Auth via session Supabase
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Validar body
  let body: { ad_account_id?: string }
  try {
    body = (await req.json()) as { ad_account_id?: string }
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { ad_account_id } = body
  if (!ad_account_id || typeof ad_account_id !== 'string') {
    return NextResponse.json(
      { error: 'Campo ad_account_id obrigatório (ex: "act_1234567890")' },
      { status: 400 }
    )
  }

  // Normalizar: garantir prefixo act_
  const normalizedAccountId = ad_account_id.startsWith('act_')
    ? ad_account_id
    : `act_${ad_account_id}`

  const admin = getAdminSupabase()

  // Buscar conexão
  const { data: conn, error: connErr } = await admin
    .from('social_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (connErr || !conn) {
    return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })
  }

  // Verificar que a empresa pertence ao user (simula RLS)
  const { data: empresaCheck } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', conn.empresa_id)
    .single()

  if (!empresaCheck) {
    return NextResponse.json(
      { error: 'Sem permissão para esta conexão' },
      { status: 403 }
    )
  }

  if (conn.provider !== 'meta_ads') {
    return NextResponse.json(
      { error: 'Este endpoint é exclusivo para conexões meta_ads' },
      { status: 422 }
    )
  }

  // Validar que a conta escolhida está na lista de contas disponíveis
  const connection = conn as Connection
  const availableAccounts = (
    connection.metadata?.available_accounts as Array<{
      id: string
      name: string
      currency: string
    }> | undefined
  ) ?? []

  const matchingAccount = availableAccounts.find(
    (a) =>
      a.id === normalizedAccountId ||
      a.id === ad_account_id ||
      `act_${a.id}` === normalizedAccountId
  )

  if (!matchingAccount) {
    return NextResponse.json(
      {
        error: `Conta "${normalizedAccountId}" não encontrada nas contas disponíveis desta conexão`,
        available_accounts: availableAccounts,
      },
      { status: 422 }
    )
  }

  // Normalizar o ID da conta encontrada (pode vir sem act_ em available_accounts)
  const finalAccountId = matchingAccount.id.startsWith('act_')
    ? matchingAccount.id
    : `act_${matchingAccount.id}`
  const numericAccountId = finalAccountId.replace('act_', '')

  // Atualizar metadata.active_account_id e provider_user_id
  const updatedMetadata = {
    ...connection.metadata,
    active_account_id: finalAccountId,
    ad_account_id: finalAccountId,
    currency: matchingAccount.currency,
  }

  const { data: updated, error: updateErr } = await admin
    .from('social_connections')
    .update({
      provider_user_id: numericAccountId,
      display_name: matchingAccount.name,
      display_label: matchingAccount.name,
      username: matchingAccount.name,
      metadata: updatedMetadata,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
    .select()
    .single()

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: `Erro ao atualizar conexão: ${updateErr?.message ?? 'desconhecido'}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    connection: updated as Connection,
    selected_account: {
      id: finalAccountId,
      name: matchingAccount.name,
      currency: matchingAccount.currency,
    },
  })
}
