-- Devorando ENEM: tabelas e regras de segurança (Supabase / PostgreSQL).
-- Cole este arquivo inteiro no "SQL Editor" do painel do Supabase e clique em Run.

-- 1) Perfis (um por conta)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) Dados completos de cada pessoa (respostas, simulados, marcadas) — privados
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Resumo de desempenho — visível ao próprio usuário e ao administrador
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  respondidas int not null default 0,
  acertos int not null default 0,
  simulados int not null default 0,
  ultimo_pct int,
  por_materia jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Função que diz se quem está logado é administrador
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Segurança por linha (RLS)
alter table public.profiles   enable row level security;
alter table public.user_data  enable row level security;
alter table public.user_stats enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ninguém consegue se promover a administrador: só o nome pode ser alterado pelo app
revoke update on public.profiles from authenticated, anon;
grant update (nome) on public.profiles to authenticated;

drop policy if exists user_data_all on public.user_data;
create policy user_data_all on public.user_data for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_stats_select on public.user_stats;
create policy user_stats_select on public.user_stats for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_stats_write on public.user_stats;
create policy user_stats_write on public.user_stats for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_stats_update on public.user_stats;
create policy user_stats_update on public.user_stats for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Visitantes sem login não acessam nada
revoke all on public.profiles, public.user_data, public.user_stats from anon;

-- 4) DEPOIS de criar a sua conta no site, rode esta linha para virar administrador:
-- update public.profiles set is_admin = true where email = 'matheusbrizolamontanher@gmail.com';
