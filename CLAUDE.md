# ContIA — Gerador de Conteúdo e Gestor de Redes Sociais com IA

## O que é

Plataforma SaaS para gestores de múltiplas empresas criarem, agendarem e analisarem conteúdo para redes sociais usando IA. Cada empresa tem seu perfil de configurações, cores, logo e preferências que alimentam a geração de conteúdo personalizado.

## Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: API Routes (Next.js)
- **Banco**: Supabase (PostgreSQL + Auth)
- **IA**: OpenAI (GPT-4o-mini para texto, GPT-4o para análise visual, DALL-E 3 para imagens)
- **UI**: Tema escuro com fades e texturas estilo IA, Lucide Icons

## Como rodar

```bash
cp .env.example .env.local   # preencher com suas credenciais
npm install
npm run dev                   # http://localhost:3000
```

Sem Supabase configurado, a plataforma roda em modo mock com dados fictícios.

## Estrutura

```
src/
├── app/
│   ├── api/ai/              # API routes de IA
│   │   ├── generate/         # Geração de conteúdo (GPT-4o-mini)
│   │   ├── image/            # Geração de imagens (DALL-E 3)
│   │   ├── analyze-site/     # Análise de site (GPT-4o-mini)
│   │   ├── analyze-instagram/# Análise de perfil IG (GPT-4o + Vision)
│   │   └── generate-post-design/ # Design visual de posts (GPT-4o)
│   ├── auth/callback/        # OAuth callback Supabase
│   ├── dashboard/            # Painel principal — stats, posts do dia, agendamentos
│   ├── criacao/              # Wizard de criação em 6 etapas
│   ├── calendario/           # Calendário editorial mensal com filtros
│   ├── analytics/            # Métricas — impressões, engajamento, crescimento
│   ├── concorrentes/         # Rastreador de concorrentes multi-rede
│   ├── noticias/             # Consolidador de notícias RSS por nicho
│   ├── configuracoes/        # Configurações por empresa (7 abas)
│   ├── login/                # Autenticação
│   └── register/             # Cadastro
├── components/
│   ├── criacao/wizard/       # Steps do wizard de criação
│   ├── empresas/             # Wizard de cadastro de empresa
│   └── layout/               # AppShell, Sidebar, EmpresaProvider
├── hooks/                    # useEmpresa, useUser, usePosts, useTemplates, useCreationWizard
├── lib/
│   ├── ai/                   # Config e prompts para OpenAI
│   ├── supabase/             # Client, server, middleware, config
│   ├── mock-data.ts          # Dados fictícios para dev sem Supabase
│   ├── empresas.ts           # CRUD Supabase de empresas
│   ├── posts.ts              # CRUD Supabase de posts
│   ├── templates.ts          # Templates via localStorage
│   └── utils.ts              # Utilitários (cn, cores, labels)
├── types/                    # TypeScript types (index.ts, ai.ts)
├── middleware.ts             # Auth middleware — protege rotas
└── supabase/migrations/      # Schema SQL
```

## Módulos da Plataforma

| Módulo | Rota | Status |
|--------|------|--------|
| Dashboard | `/dashboard` | Funcional |
| Criação (Wizard 6 etapas) | `/criacao` | Funcional |
| Calendário Editorial | `/calendario` | Funcional |
| Analytics | `/analytics` | Funcional (mock) |
| Concorrentes | `/concorrentes` | Funcional (mock) |
| Notícias RSS | `/noticias` | Funcional (mock) |
| Configurações (7 abas) | `/configuracoes` | Funcional |
| Login / Registro | `/login`, `/register` | Funcional |

## Wizard de Criação (6 etapas)

1. **Templates** — Escolher template salvo ou começar do zero
2. **Analysis** — Analisar site e/ou Instagram da empresa para capturar tom/estilo
3. **Format** — Escolher formato (post, carrossel, reels, email, copy)
4. **Generate** — IA gera o conteúdo baseado no contexto da empresa
5. **Preview** — Visualizar e editar o post gerado (com design visual)
6. **Export** — Salvar, agendar ou exportar

## Banco de Dados (Supabase)

Tabelas: `empresas`, `posts`, `concorrentes`, `concorrente_plataformas`

- Auth via Supabase Auth (email/password)
- RLS configurado por `user_id`
- Modo mock automático quando Supabase não está configurado

## Variáveis de Ambiente

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim* | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim* | Chave anon do Supabase |
| `OPENAI_API_KEY` | Sim* | Geração de conteúdo e imagens |

*Sem essas variáveis, a plataforma roda em modo mock.

## Deploy

- **Dev**: `npm run dev` (localhost:3000)
- **Produção**: Coolify (atrelado a este repositório GitHub)
- **Build**: `npm run build` → `npm start`

## Convenções

- Linguagem da UI e variáveis de domínio: PT-BR
- Código (funções, componentes, types): inglês
- Commits: Conventional Commits em português
- Estilo: Tailwind CSS com variáveis CSS customizadas no globals.css

## Próximos Passos

- [ ] Conectar APIs reais de redes sociais (Meta, LinkedIn) para Analytics
- [ ] Implementar agendamento real de posts (cron/queue)
- [ ] Integrar RSS real no consolidador de notícias
- [ ] Adicionar scraping real de concorrentes
- [ ] Deploy no Coolify via GitHub
- [ ] Implementar multi-tenancy completo com RLS
