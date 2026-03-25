-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Empresas ──
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  nicho text not null default '',
  logo_url text,
  website text,
  cor_primaria text not null default '#6c5ce7',
  cor_secundaria text not null default '#a29bfe',
  redes_sociais jsonb not null default '{}',
  config_rss jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Posts ──
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  conteudo text not null default '',
  midia_url text,
  plataformas text[] not null default '{}',
  status text not null default 'rascunho' check (status in ('rascunho','agendado','publicado','erro')),
  agendado_para timestamptz,
  publicado_em timestamptz,
  tematica text not null default '',
  metricas jsonb,
  created_at timestamptz default now()
);

-- ── Concorrentes ──
create table public.concorrentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  created_at timestamptz default now()
);

create table public.concorrente_plataformas (
  id uuid primary key default gen_random_uuid(),
  concorrente_id uuid not null references public.concorrentes(id) on delete cascade,
  rede text not null,
  username text not null,
  seguidores integer default 0,
  taxa_engajamento real default 0,
  freq_postagem text default '',
  posts_recentes jsonb default '[]'
);

-- ── Updated at trigger ──
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger empresas_updated_at
  before update on public.empresas
  for each row execute function public.handle_updated_at();

-- ── RLS ──
alter table public.empresas enable row level security;
alter table public.posts enable row level security;
alter table public.concorrentes enable row level security;
alter table public.concorrente_plataformas enable row level security;

-- Empresas: user can only access their own
create policy "Users can view own empresas" on public.empresas for select using (user_id = auth.uid());
create policy "Users can insert own empresas" on public.empresas for insert with check (user_id = auth.uid());
create policy "Users can update own empresas" on public.empresas for update using (user_id = auth.uid());
create policy "Users can delete own empresas" on public.empresas for delete using (user_id = auth.uid());

-- Posts: user can access posts of their empresas
create policy "Users can view own posts" on public.posts for select using (empresa_id in (select id from public.empresas where user_id = auth.uid()));
create policy "Users can insert own posts" on public.posts for insert with check (empresa_id in (select id from public.empresas where user_id = auth.uid()));
create policy "Users can update own posts" on public.posts for update using (empresa_id in (select id from public.empresas where user_id = auth.uid()));
create policy "Users can delete own posts" on public.posts for delete using (empresa_id in (select id from public.empresas where user_id = auth.uid()));

-- Concorrentes: same pattern
create policy "Users can view own concorrentes" on public.concorrentes for select using (empresa_id in (select id from public.empresas where user_id = auth.uid()));
create policy "Users can insert own concorrentes" on public.concorrentes for insert with check (empresa_id in (select id from public.empresas where user_id = auth.uid()));
create policy "Users can update own concorrentes" on public.concorrentes for update using (empresa_id in (select id from public.empresas where user_id = auth.uid()));
create policy "Users can delete own concorrentes" on public.concorrentes for delete using (empresa_id in (select id from public.empresas where user_id = auth.uid()));

-- Concorrente plataformas: through concorrentes
create policy "Users can view own concorrente_plataformas" on public.concorrente_plataformas for select using (concorrente_id in (select id from public.concorrentes where empresa_id in (select id from public.empresas where user_id = auth.uid())));
create policy "Users can insert own concorrente_plataformas" on public.concorrente_plataformas for insert with check (concorrente_id in (select id from public.concorrentes where empresa_id in (select id from public.empresas where user_id = auth.uid())));
create policy "Users can update own concorrente_plataformas" on public.concorrente_plataformas for update using (concorrente_id in (select id from public.concorrentes where empresa_id in (select id from public.empresas where user_id = auth.uid())));
create policy "Users can delete own concorrente_plataformas" on public.concorrente_plataformas for delete using (concorrente_id in (select id from public.concorrentes where empresa_id in (select id from public.empresas where user_id = auth.uid())));

-- Indexes
create index idx_empresas_user_id on public.empresas(user_id);
create index idx_posts_empresa_id on public.posts(empresa_id);
create index idx_posts_status on public.posts(status);
create index idx_concorrentes_empresa_id on public.concorrentes(empresa_id);
