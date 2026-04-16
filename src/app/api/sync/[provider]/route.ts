export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDriver } from '@/lib/drivers/registry'
import type { ProviderKey, SyncJobType, SyncOptions, Connection } from '@/types/providers'

/**
 * POST /api/sync/[provider]
 *
 * Endpoint genérico de sincronização para qualquer provider.
 * Valida auth, busca driver, executa sync e atualiza sync_jobs.
 *
 * Body:
 * {
 *   job_type: 'profile_sync' | 'content_sync' | 'insights_sync' | 'backfill' | 'token_refresh' | 'all',
 *   connection_id: string,
 *   options?: { since?: string, until?: string, contentLimit?: number, includeInsights?: boolean }
 * }
 */

interface SyncRequestBody {
  job_type: SyncJobType | 'all'
  connection_id: string
  options?: {
    since?: string
    until?: string
    contentLimit?: number
    includeInsights?: boolean
  }
}

const VALID_JOB_TYPES: Array<SyncJobType | 'all'> = [
  'profile_sync',
  'content_sync',
  'insights_sync',
  'backfill',
  'token_refresh',
  'all',
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params
    const provider = providerParam as ProviderKey

    // Validar body
    const body = (await req.json()) as SyncRequestBody

    if (!body.job_type || !VALID_JOB_TYPES.includes(body.job_type)) {
      return NextResponse.json(
        { error: `job_type inválido. Use: ${VALID_JOB_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!body.connection_id) {
      return NextResponse.json(
        { error: 'connection_id obrigatório' },
        { status: 400 }
      )
    }

    // Verificar autenticação
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar conexão e validar que pertence ao user
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('id', body.connection_id)
      .eq('is_active', true)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Conexão não encontrada ou inativa' },
        { status: 404 }
      )
    }

    if (connection.provider !== provider) {
      return NextResponse.json(
        { error: `Conexão é do provider "${connection.provider}", não "${provider}"` },
        { status: 400 }
      )
    }

    // Validar que o user tem acesso à empresa
    const { data: empresa } = await supabase
      .from('empresas')
      .select('id')
      .eq('id', connection.empresa_id)
      .eq('user_id', user.id)
      .single()

    if (!empresa) {
      return NextResponse.json(
        { error: 'Sem acesso a esta empresa' },
        { status: 403 }
      )
    }

    // Buscar driver
    const driver = getDriver(provider)
    if (!driver) {
      return NextResponse.json(
        { error: `Provider "${provider}" ainda não implementado` },
        { status: 501 }
      )
    }

    // Criar sync_job no banco
    const jobId = crypto.randomUUID()
    const { error: jobCreateError } = await supabase.from('sync_jobs').insert({
      id: jobId,
      empresa_id: connection.empresa_id,
      connection_id: body.connection_id,
      provider,
      job_type: body.job_type === 'all' ? 'backfill' : body.job_type,
      status: 'running',
      started_at: new Date().toISOString(),
    })

    if (jobCreateError) {
      console.error('[Sync] Erro ao criar sync_job:', jobCreateError)
      // Continua mesmo sem conseguir registrar o job
    }

    // Preparar options
    const syncOptions: SyncOptions = {}
    if (body.options?.since) syncOptions.since = new Date(body.options.since)
    if (body.options?.until) syncOptions.until = new Date(body.options.until)
    if (body.options?.contentLimit) syncOptions.contentLimit = body.options.contentLimit
    if (body.options?.includeInsights) syncOptions.includeInsights = body.options.includeInsights

    // Executar sync
    const typedConnection = connection as unknown as Connection
    const results: Record<string, unknown> = {}
    const errors: string[] = []

    const jobTypes: SyncJobType[] =
      body.job_type === 'all'
        ? ['profile_sync', 'content_sync', 'insights_sync']
        : [body.job_type]

    for (const jt of jobTypes) {
      try {
        switch (jt) {
          case 'profile_sync': {
            const profile = await driver.syncProfile(typedConnection)
            results.profile = profile

            // Salvar snapshot do dia
            const today = new Date().toISOString().split('T')[0]
            await supabase.from('provider_snapshots').upsert(
              {
                empresa_id: connection.empresa_id,
                connection_id: body.connection_id,
                provider,
                snapshot_date: today,
                metrics: {
                  followers_count: profile.followers_count,
                  following_count: profile.following_count,
                  content_count: profile.content_count,
                  ...profile.extra,
                },
              },
              { onConflict: 'connection_id,snapshot_date' }
            )
            break
          }

          case 'content_sync': {
            const items = await driver.syncContent(typedConnection, syncOptions)
            results.content_count = items.length

            // Upsert em content_items
            if (items.length > 0) {
              const rows = items.map((item) => ({
                empresa_id: connection.empresa_id,
                connection_id: body.connection_id,
                provider,
                provider_content_id: item.provider_content_id,
                content_type: item.content_type,
                title: item.title,
                caption: item.caption,
                url: item.url,
                thumbnail_url: item.thumbnail_url,
                published_at: item.published_at,
                metrics: item.metrics,
                raw: item.raw,
                synced_at: new Date().toISOString(),
              }))

              const { error: upsertError } = await supabase
                .from('content_items')
                .upsert(rows, { onConflict: 'connection_id,provider_content_id' })

              if (upsertError) {
                errors.push(`content_sync upsert: ${upsertError.message}`)
              }
            }
            break
          }

          case 'insights_sync': {
            if (driver.syncInsights) {
              // Buscar content_items recentes para pedir insights
              const { data: recentItems } = await supabase
                .from('content_items')
                .select('provider_content_id')
                .eq('connection_id', body.connection_id)
                .order('published_at', { ascending: false })
                .limit(syncOptions.contentLimit ?? 25)

              const contentIds = (recentItems ?? []).map(
                (r: { provider_content_id: string }) => r.provider_content_id
              )

              if (contentIds.length > 0) {
                const insights = await driver.syncInsights(typedConnection, contentIds)
                results.insights_count = insights.length

                // Atualizar métricas nos content_items
                for (const insight of insights) {
                  await supabase
                    .from('content_items')
                    .update({ metrics: insight.metrics, synced_at: new Date().toISOString() })
                    .eq('connection_id', body.connection_id)
                    .eq('provider_content_id', insight.provider_content_id)
                }
              } else {
                results.insights_count = 0
              }
            } else {
              results.insights_skipped = true
            }
            break
          }

          case 'token_refresh': {
            const refreshed = await driver.refreshToken(typedConnection)
            results.token_refreshed = true

            // Atualizar token no banco
            await supabase
              .from('social_connections')
              .update({
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token,
                token_expires_at: refreshed.token_expires_at,
                updated_at: new Date().toISOString(),
              })
              .eq('id', body.connection_id)
            break
          }

          case 'backfill': {
            // Backfill = profile + content com range estendido
            const backfillProfile = await driver.syncProfile(typedConnection)
            results.profile = backfillProfile

            const backfillOptions: SyncOptions = {
              ...syncOptions,
              contentLimit: syncOptions.contentLimit ?? 100,
            }
            const backfillItems = await driver.syncContent(typedConnection, backfillOptions)
            results.content_count = backfillItems.length

            if (backfillItems.length > 0) {
              const rows = backfillItems.map((item) => ({
                empresa_id: connection.empresa_id,
                connection_id: body.connection_id,
                provider,
                provider_content_id: item.provider_content_id,
                content_type: item.content_type,
                title: item.title,
                caption: item.caption,
                url: item.url,
                thumbnail_url: item.thumbnail_url,
                published_at: item.published_at,
                metrics: item.metrics,
                raw: item.raw,
                synced_at: new Date().toISOString(),
              }))

              await supabase
                .from('content_items')
                .upsert(rows, { onConflict: 'connection_id,provider_content_id' })
            }
            break
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${jt}: ${msg}`)
      }
    }

    // Atualizar sync_job
    const finalStatus = errors.length > 0 ? 'failed' : 'completed'
    await supabase
      .from('sync_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        result: results,
        last_error: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', jobId)

    return NextResponse.json({
      success: errors.length === 0,
      job_id: jobId,
      provider,
      status: finalStatus,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno no sync'
    console.error('[Sync] Erro não tratado:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
