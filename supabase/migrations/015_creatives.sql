-- 015_creatives.sql
-- Módulo Gerador de Criativos IA — tabelas de chat + bucket Storage
-- ADITIVA — NÃO remove nenhuma tabela/coluna existente.

-- ─────────────────────────────────────────────────────────────
-- 1. Conversations
-- ─────────────────────────────────────────────────────────────
create table if not exists public.creative_conversations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Messages
-- ─────────────────────────────────────────────────────────────
create table if not exists public.creative_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.creative_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  html text,
  png_url text,
  model text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. Índices
-- ─────────────────────────────────────────────────────────────
create index if not exists creative_conversations_empresa_updated_idx
  on public.creative_conversations(empresa_id, updated_at desc);

create index if not exists creative_messages_conversation_idx
  on public.creative_messages(conversation_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────
alter table public.creative_conversations enable row level security;
alter table public.creative_messages enable row level security;

-- Nota: is_empresa_member(uuid, text) — segundo param é TEXT (ver migration 014).
-- Passar string literal 'creator' diretamente, sem cast ::empresa_role.

drop policy if exists creative_conversations_all on public.creative_conversations;
create policy creative_conversations_all on public.creative_conversations
  for all
  using (public.is_empresa_member(empresa_id, 'creator'))
  with check (public.is_empresa_member(empresa_id, 'creator'));

drop policy if exists creative_messages_all on public.creative_messages;
create policy creative_messages_all on public.creative_messages
  for all
  using (
    exists (
      select 1 from public.creative_conversations c
      where c.id = conversation_id
        and public.is_empresa_member(c.empresa_id, 'creator')
    )
  )
  with check (
    exists (
      select 1 from public.creative_conversations c
      where c.id = conversation_id
        and public.is_empresa_member(c.empresa_id, 'creator')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger updated_at
-- ─────────────────────────────────────────────────────────────
drop trigger if exists set_creative_conv_updated on public.creative_conversations;
create trigger set_creative_conv_updated
  before update on public.creative_conversations
  for each row execute procedure public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. Storage bucket
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('creatives', 'creatives', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 7. Storage policies (path convention: {empresa_id}/{message_id}.png)
-- ─────────────────────────────────────────────────────────────
drop policy if exists creatives_bucket_select on storage.objects;
create policy creatives_bucket_select on storage.objects
  for select using (
    bucket_id = 'creatives'
    and exists (
      select 1 from public.empresas e
      where e.id::text = (storage.foldername(name))[1]
        and public.is_empresa_member(e.id, 'creator')
    )
  );

drop policy if exists creatives_bucket_insert on storage.objects;
create policy creatives_bucket_insert on storage.objects
  for insert with check (
    bucket_id = 'creatives'
    and exists (
      select 1 from public.empresas e
      where e.id::text = (storage.foldername(name))[1]
        and public.is_empresa_member(e.id, 'creator')
    )
  );

drop policy if exists creatives_bucket_delete on storage.objects;
create policy creatives_bucket_delete on storage.objects
  for delete using (
    bucket_id = 'creatives'
    and exists (
      select 1 from public.empresas e
      where e.id::text = (storage.foldername(name))[1]
        and public.is_empresa_member(e.id, 'creator')
    )
  );
