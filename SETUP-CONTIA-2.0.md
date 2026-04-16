# ContIA 2.0 — Setup pendente

Esta sessao (2026-04-15) implementou 9 de 13 fases do plano ContIA 2.0.
**Para ativar em producao, voce precisa fazer 7 acoes manuais.**

## O que ja esta pronto

- Migration 009 executada no Supabase producao — 7 tabelas criadas (provider_snapshots, content_items, metric_events, reports, scheduled_reports, ai_analyses, sync_jobs), 28 RLS policies, 7 indexes, 1 trigger
- Paginas legais `/privacidade` e `/termos` com layout dedicado, TOC navegavel, SEO (metadata + canonical)
- PUBLIC_ROUTES atualizado no AppShell — paginas legais acessiveis sem login
- Pagina `/setup` com 9 cards interativos, progresso persistido em localStorage, gerador de API key integrado
- Item "Setup" adicionado na Sidebar (icone Wrench)
- Driver CRM (`src/lib/drivers/crm.ts`) integrado com endpoint `/api/analytics/export` do CRM
- Middleware `apiKey.ts` no CRM validando header `X-API-Key` contra `ANALYTICS_API_KEY`
- Componentes reutilizaveis: SetupCard, CodeBlock, StepIndicator, useSetupProgress
- TypeScript compila limpo tanto no ContIA quanto no CRM (packages/api)

## O que VOCE precisa fazer

Acesse https://contia.bertuzzipatrimonial.com.br/setup para o checklist interativo completo.

Resumo:
1. **Verificar migration** — abra o SQL Editor do Supabase e confirme as 7 tabelas (ja verificado por script, mas confira visualmente)
2. **Preencher placeholders legais** — abra `/privacidade` e `/termos`, substitua [CNPJ], [ENDERECO], [RAZAO_SOCIAL], [DPO], [Comarca] com dados reais da Bertuzzi Patrimonial
3. **Meta App: Redirect URIs** — adicionar 3 callback URLs (Instagram, Facebook, Meta Ads) no Facebook Login Settings
4. **Meta App: Privacy Policy + Terms URLs** — colar as URLs das paginas legais no App Settings > Basic
5. **Meta App: Testers** — adicionar testers no App Roles + Instagram API Setup; cada tester precisa aceitar convite
6. **Criar LinkedIn App** — developers.linkedin.com, configurar redirect URI, ativar Products (Sign In + Share), copiar Client ID/Secret
7. **Coolify env vars** — adicionar LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, CRM_API_URL, CRM_ANALYTICS_API_KEY no ContIA + ANALYTICS_API_KEY no CRM (mesma chave dos dois lados), redeploy ambos
8. **Google Ads Developer Token** — solicitar no API Center (leva 1-2 semanas, faca o quanto antes)
9. **Instagram Testers** — adicionar e aceitar convites no app do Instagram

## Proximas fases (Claude faz quando voce pedir)

- **Fase 6**: Google stack (YouTube + GA4 + Google Ads) — depende do Developer Token (item 8 acima)
- **Fase 9**: Dashboard /insights unificado — painel consolidado de todas as redes + CRM
- **Fase 11**: PDF reports — geracao e envio automatico de relatorios
- **Fase 12**: Agendamento — publicacao automatica de posts nas redes conectadas

## Issues conhecidos

- **Placeholders nas paginas legais**: [CNPJ], [ENDERECO], [Comarca a confirmar] ainda presentes em `/privacidade` e `/termos` — precisam ser preenchidos manualmente antes de submeter o Meta App para review
- **Google Ads bloqueado**: Developer Token pode levar 1-2 semanas para aprovacao — toda a Fase 6 depende disso
- **ContIA deploy**: NAO tem webhook GitHub automatico — precisa chamar API Coolify manualmente ou fazer redeploy pelo painel apos cada push
- **Meta App em dev mode**: Apenas testers adicionados manualmente conseguem usar OAuth (Instagram/Facebook/Meta Ads)

## Como continuar

1. Abra o Claude nesta pasta
2. Use `/abrir-projeto` e escolha ContIA, ou simplesmente diga:
   - "continua o ContIA 2.0" — Claude retoma de onde parou
   - "faz o Google stack" — inicia Fase 6 (YouTube + GA4 + Ads)
   - "faz o dashboard /insights" — inicia Fase 9
   - "faz os PDF reports" — inicia Fase 11
