import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { linkedinDriverExtended } from '@/lib/drivers/linkedin'
import type { Connection } from '@/types/providers'

export const runtime = 'nodejs'

/**
 * POST /api/linkedin/publish
 *
 * Publica um post de TEXTO no feed pessoal do usuário LinkedIn.
 *
 * Nível 1 — APENAS feed pessoal.
 * Publicação em Company Page requer LinkedIn CMA approval.
 *
 * Body JSON:
 * {
 *   empresa_id: string       — ID da empresa (para buscar a conexão)
 *   content: string          — texto do post (máx. recomendado: 3.000 chars)
 *   visibility?: "PUBLIC" | "CONNECTIONS"   — padrão: "PUBLIC"
 * }
 *
 * Resposta de sucesso:
 * {
 *   success: true,
 *   post_id: string
 * }
 */
export async function POST(req: NextRequest) {
  // Verificar autenticação
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { empresa_id?: string; content?: string; visibility?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { empresa_id, content, visibility } = body

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: 'content obrigatório' }, { status: 400 })
  }

  if (content.length > 3000) {
    return NextResponse.json(
      { error: 'content excede 3.000 caracteres (limite do LinkedIn para feed pessoal)' },
      { status: 400 }
    )
  }

  if (visibility && visibility !== 'PUBLIC' && visibility !== 'CONNECTIONS') {
    return NextResponse.json(
      { error: 'visibility deve ser "PUBLIC" ou "CONNECTIONS"' },
      { status: 400 }
    )
  }

  // Buscar conexão ativa do LinkedIn para esta empresa
  const { data: connection, error: dbError } = await supabase
    .from('social_connections')
    .select('*')
    .eq('empresa_id', empresa_id)
    .eq('provider', 'linkedin')
    .eq('is_active', true)
    .single()

  if (dbError || !connection) {
    return NextResponse.json(
      { error: 'LinkedIn não conectado. Acesse /conexoes para conectar.' },
      { status: 404 }
    )
  }

  // Verificar se token ainda está válido (verificação simples por data)
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at as string)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        {
          error:
            'Token LinkedIn expirado. Acesse /conexoes para reconectar. ' +
            'Tokens do LinkedIn Nível 1 duram 60 dias e precisam de reconexão manual.',
        },
        { status: 401 }
      )
    }
  }

  try {
    const result = await linkedinDriverExtended.publishToFeed(
      connection as Connection,
      content.trim(),
      (visibility as 'PUBLIC' | 'CONNECTIONS') ?? 'PUBLIC'
    )

    return NextResponse.json({
      success: true,
      post_id: result.postId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao publicar no LinkedIn'
    console.error('[LinkedIn Publish]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
