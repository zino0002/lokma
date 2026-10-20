create table if not exists public.user_kitchens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_account_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.user_account_status (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_user_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_account_status (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_user_account_status() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_account_status on auth.users;
create trigger on_auth_user_created_account_status
  after insert on auth.users
  for each row execute function public.create_user_account_status();

create or replace function public.set_my_account_active(p_is_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.user_account_status
  set is_active = p_is_active, updated_at = now()
  where user_id = (select auth.uid());
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.set_my_account_active(boolean) from public, anon;
grant execute on function public.set_my_account_active(boolean) to authenticated;

alter table public.user_kitchens enable row level security;
alter table public.user_account_status enable row level security;

grant select, insert, update on public.user_kitchens to authenticated;
grant select on public.user_account_status to authenticated;

drop policy if exists "Users can read their own kitchen" on public.user_kitchens;
create policy "Users can read their own kitchen"
  on public.user_kitchens
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_account_status
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy if exists "Users can create their own kitchen" on public.user_kitchens;
create policy "Users can create their own kitchen"
  on public.user_kitchens
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_account_status
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy if exists "Users can update their own kitchen" on public.user_kitchens;
create policy "Users can update their own kitchen"
  on public.user_kitchens
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_account_status
      where user_id = (select auth.uid()) and is_active
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_account_status
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy if exists "Users can read their own account status" on public.user_account_status;
create policy "Users can read their own account status"
  on public.user_account_status
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
