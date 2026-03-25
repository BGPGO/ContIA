-- Add source fields to empresas
alter table public.empresas
  add column if not exists instagram_handle text,
  add column if not exists concorrentes_ig text[] not null default '{}',
  add column if not exists referencias_ig text[] not null default '{}',
  add column if not exists referencias_sites text[] not null default '{}';

-- Marca DNA table
create table public.marca_dna (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade unique,
  instagram_analysis jsonb not null default '{}',
  site_analysis jsonb not null default '{}',
  concorrentes_analysis jsonb not null default '[]',
  referencias_analysis jsonb not null default '[]',
  dna_sintetizado jsonb not null default '{}',
  status text not null default 'pendente' check (status in ('pendente', 'analisando', 'completo', 'erro')),
  ultima_analise timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger marca_dna_updated_at before update on public.marca_dna
  for each row execute function public.handle_updated_at();

alter table public.marca_dna enable row level security;

create policy "Users can view own marca_dna" on public.marca_dna for select
  using (empresa_id in (select id from public.empresas where user_id = auth.uid()));

create policy "Users can manage own marca_dna" on public.marca_dna for all
  using (empresa_id in (select id from public.empresas where user_id = auth.uid()));
