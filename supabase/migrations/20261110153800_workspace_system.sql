-- JUNOBI ARBOR: workspace system (membership, roles, soft delete, business-data RLS).
--
-- REVIEW BEFORE RUNNING. Nothing in this repo executes it.
-- Run as the migration/owner role (Supabase: `postgres`, which bypasses RLS) in the SQL
-- editor or via `supabase db push`. It is idempotent: safe to re-run.
--
-- Preserved: all tables, rows and foreign keys. Nothing is dropped except POLICIES on
-- products / transactions / transaction_items, which are replaced by membership-based
-- policies (the owner is a member, so owner access is kept).
--
-- Assumed existing schema (verified below; the whole transaction aborts otherwise):
--   workspaces(id uuid default, owner_id uuid, name text, created_at timestamptz)
--   products.workspace_id uuid, transactions.workspace_id uuid,
--   transaction_items.transaction_id uuid -> transactions.id
--
-- Role matrix (an active, non-Trash workspace is required for ALL business-data access):
--   owner    full access; rename, move to Trash, restore
--   admin    full business data; rename workspace
--   manager  products + transactions (+ items): read, create, update, delete
--   employee read everything operational; create transactions and items only
--
-- Open product decisions: Trash does not use an owned-workspace slot (restore re-checks
-- the cap); trashed workspaces are fully inaccessible to members (owners still see them
-- in Trash); invitation permissions (table exists, no client access).

begin;

set local lock_timeout = '10s';

-- 0a. Optional-column guards: reject inconsistent existing data before anything changes.
do $$
declare
  v_bad bigint;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transaction_items' and column_name = 'workspace_id'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'transaction_items'
        and column_name = 'workspace_id' and data_type = 'uuid'
    ) then
      raise exception 'transaction_items.workspace_id must be uuid';
    end if;
    if to_regclass('public.transactions') is not null then
      execute 'select count(*) from public.transaction_items i
               left join public.transactions t on t.id = i.transaction_id
               where i.workspace_id is distinct from t.workspace_id'
        into v_bad;
      if v_bad > 0 then
        raise exception '% transaction_items rows have a workspace_id that differs from their parent transaction. Fix manually before applying.', v_bad;
      end if;
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions'
      and column_name = 'created_by' and data_type <> 'uuid'
  ) then
    raise exception 'transactions.created_by must be uuid';
  end if;
end $$;

-- 0. Compatibility guards --------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception 'Run this migration as a role that bypasses RLS (e.g. postgres)';
  end if;

  if to_regclass('public.workspaces') is null then
    raise exception 'Existing public.workspaces table is required';
  end if;

  select string_agg(e.t || '.' || e.c, ', ') into v_missing
  from (values
    ('workspaces', 'id', 'uuid'),
    ('workspaces', 'owner_id', 'uuid'),
    ('workspaces', 'name', 'text'),
    ('workspaces', 'created_at', 'timestamp with time zone'),
    ('products', 'workspace_id', 'uuid'),
    ('transactions', 'workspace_id', 'uuid'),
    ('transaction_items', 'transaction_id', 'uuid')
  ) as e(t, c, ty)
  where not exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public' and ic.table_name = e.t
      and ic.column_name = e.c and ic.data_type = e.ty
  );
  if v_missing is not null then
    raise exception 'Unexpected live schema, missing or mistyped columns: %. Reconcile before applying.', v_missing;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspaces'
      and column_name = 'id' and column_default is not null
  ) then
    raise exception 'workspaces.id must have a default value';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspaces'
      and column_name = 'deleted_at' and data_type <> 'timestamp with time zone'
  ) then
    raise exception 'workspaces.deleted_at exists with an incompatible type';
  end if;

  if exists (select 1 from public.workspaces where owner_id is null) then
    raise exception 'Every workspace must have an owner_id before migration';
  end if;
  if exists (select 1 from public.products where workspace_id is null)
    or exists (select 1 from public.transactions where workspace_id is null) then
    raise exception 'products/transactions contain rows without workspace_id; assign them to a workspace first (they would become inaccessible)';
  end if;
  if exists (
    select 1 from public.transaction_items i
    where not exists (select 1 from public.transactions t where t.id = i.transaction_id)
  ) then
    raise exception 'transaction_items contains orphan rows; fix them first';
  end if;

  -- Every owner must be a real auth user, otherwise the Owner membership cannot be created.
  if exists (
    select 1 from public.workspaces w
    where not exists (select 1 from auth.users u where u.id = w.owner_id)
  ) then
    raise exception 'Some workspaces.owner_id values do not exist in auth.users; fix them first';
  end if;

  -- Primary keys that the policies and foreign keys rely on.
  select string_agg(e.t, ', ') into v_missing
  from (values ('workspaces'), ('transactions')) as e(t)
  where not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = format('public.%I', e.t)::regclass and c.contype = 'p'
      and c.conkey = array[(
        select a.attnum from pg_catalog.pg_attribute a where a.attrelid = c.conrelid and a.attname = 'id'
      )]
  );
  if v_missing is not null then
    raise exception 'Tables without a primary key on id: %', v_missing;
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'transactions' and column_name = 'id') <> 'uuid' then
    raise exception 'transactions.id must be uuid';
  end if;

  -- Foreign keys that tie business rows to a workspace / transaction. Without them, rows
  -- could point at nothing and survive workspace deletion unpredictably.
  select string_agg(e.child || '.' || e.col || ' -> ' || e.parent, ', ') into v_missing
  from (values
    ('products', 'workspace_id', 'workspaces'),
    ('transactions', 'workspace_id', 'workspaces'),
    ('transaction_items', 'transaction_id', 'transactions')
  ) as e(child, col, parent)
  where not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.conrelid = format('public.%I', e.child)::regclass
      and c.confrelid = format('public.%I', e.parent)::regclass
      and c.conkey = array[(
        select a.attnum from pg_catalog.pg_attribute a where a.attrelid = c.conrelid and a.attname = e.col
      )]
  );
  if v_missing is not null then
    raise exception 'Missing foreign keys: %. Add or reconcile them before applying.', v_missing;
  end if;

  -- Pre-existing membership objects must have a compatible shape and clean owner data.
  if to_regclass('public.workspace_members') is not null then
    if exists (
      select 1 from (values ('workspace_id', 'uuid'), ('user_id', 'uuid')) as e(c, ty)
      where not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'workspace_members'
          and column_name = e.c and data_type = e.ty
      )
    ) or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'workspace_members'
        and column_name = 'role' and udt_name = 'workspace_role'
    ) then
      raise exception 'public.workspace_members exists with an incompatible shape (role must be workspace_role)';
    end if;
    if not exists (
      select 1 from pg_catalog.pg_index i
      where i.indrelid = 'public.workspace_members'::regclass and i.indisunique
        and i.indpred is null and i.indnatts = 2
        and (select array_agg(a.attname::text order by a.attname::text)
             from pg_catalog.pg_attribute a
             where a.attrelid = i.indrelid and a.attnum = any (i.indkey::int2[]))
            = array['user_id', 'workspace_id']
    ) then
      raise exception 'public.workspace_members needs a unique key on (workspace_id, user_id)';
    end if;
    if exists (
      select 1 from public.workspace_members
      where role::text not in ('owner', 'admin', 'manager', 'employee')
    ) then
      raise exception 'public.workspace_members contains unknown roles';
    end if;
    -- Checked before the one-owner unique index is created.
    if exists (
      select 1 from public.workspace_members where role::text = 'owner'
      group by workspace_id having count(*) > 1
    ) then
      raise exception 'Some workspaces have more than one Owner member; resolve them manually';
    end if;
    -- An Owner member that is not workspaces.owner_id is ambiguous; never guess.
    if exists (
      select 1 from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
      where m.role::text = 'owner' and m.user_id <> w.owner_id
    ) then
      raise exception 'Some Owner members differ from workspaces.owner_id; resolve them manually';
    end if;
  end if;
  if to_regclass('public.workspace_invitations') is not null and exists (
    select 1 from (values ('id'), ('workspace_id'), ('email'), ('role'), ('status')) as e(c)
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'workspace_invitations' and column_name = e.c
    )
  ) then
    raise exception 'public.workspace_invitations exists with an incompatible shape';
  end if;
  if to_regtype('public.workspace_role') is not null and (
    select array_agg(enumlabel::text order by enumlabel::text) from pg_catalog.pg_enum
    where enumtypid = 'public.workspace_role'::regtype
  ) is distinct from array['admin', 'employee', 'manager', 'owner'] then
    raise exception 'public.workspace_role exists with unexpected values';
  end if;

  -- Legacy workspaces policies must not read workspace tables (policy recursion).
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'workspaces'
      and policyname not like 'junobi\_%'
      and (coalesce(qual, '') ~* '\m(workspaces|workspace_members)\M'
        or coalesce(with_check, '') ~* '\m(workspaces|workspace_members)\M')
  ) then
    raise exception 'A legacy workspaces policy references workspace tables; rewrite it to avoid recursion first';
  end if;
end $$;

-- 1. Soft delete column, role type, membership and invitation tables -------------------
alter table public.workspaces add column if not exists deleted_at timestamptz;
create index if not exists workspaces_owner_active_idx
  on public.workspaces (owner_id) where deleted_at is null;
create index if not exists workspaces_trash_idx
  on public.workspaces (deleted_at) where deleted_at is not null;

do $$
begin
  if to_regtype('public.workspace_role') is null then
    create type public.workspace_role as enum ('owner', 'admin', 'manager', 'employee');
  end if;
end $$;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Backfill: workspaces.owner_id is always the Owner member. Order matters and every
-- statement is idempotent. The pre-checks already rejected ambiguous Owner rows.
-- 1) The owner is already a member with a lower role: promote that row in place.
update public.workspace_members m
set role = 'owner'
from public.workspaces w
where m.workspace_id = w.id and m.user_id = w.owner_id and m.role <> 'owner';

-- 2) The owner has no membership yet: add it. ON CONFLICT covers a concurrent insert.
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'::public.workspace_role
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

do $$
begin
  if exists (
    select 1 from public.workspaces w
    where not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = w.id and m.user_id = w.owner_id and m.role = 'owner'
    )
  ) then
    raise exception 'Owner backfill incomplete: some workspaces.owner_id lack an Owner membership';
  end if;
end $$;

-- The unique index must really be unique, partial on role = 'owner' (a same-named but
-- different pre-existing index would silently pass `if not exists`).
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'workspace_members_one_owner_idx'
      and (indexdef not ilike 'create unique index%' or indexdef not ilike '%role%owner%')
  ) then
    raise exception 'workspace_members_one_owner_idx exists with an unexpected definition';
  end if;
end $$;
create unique index if not exists workspace_members_one_owner_idx
  on public.workspace_members (workspace_id) where role = 'owner';
create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

-- Invitation structure only. RLS on, no policies, no grants: no client access until the
-- invitation permissions are decided.
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  role public.workspace_role not null check (role <> 'owner'),
  invited_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create unique index if not exists workspace_invitations_one_pending_idx
  on public.workspace_invitations (workspace_id, email) where status = 'pending';

-- 2. Helper functions (SECURITY DEFINER, owned by the RLS-bypassing migration role, so
--    policies on workspaces / workspace_members / business tables never recurse) --------
create or replace function public.workspace_trash_retention()
returns interval language sql immutable set search_path = ''
as $$ select interval '30 days' $$;

-- Single place that defines what counts toward the cap of 3: owned, not in Trash.
create or replace function public.count_owned_active_workspaces(p_user_id uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.workspaces
  where owner_id = p_user_id and deleted_at is null;
$$;

-- True only for an ACTIVE (non-Trash) workspace in which the caller has one of the roles.
create or replace function public.has_workspace_role(p_workspace_id uuid, p_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
      and w.deleted_at is null
  );
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_workspace_role(p_workspace_id, enum_range(null::public.workspace_role));
$$;

-- Boolean helpers keep the parent transaction's workspace id from being exposed to clients.
create or replace function public.has_transaction_role(p_transaction_id uuid, p_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and public.has_workspace_role(t.workspace_id, p_roles)
  );
$$;

-- Oracle-safe: the caller must hold a role in p_workspace_id for this to ever return true,
-- so it cannot reveal which workspace a transaction belongs to for workspaces the caller
-- cannot already read. It is only meant to be used inside RLS policies.
create or replace function public.transaction_in_workspace(p_transaction_id uuid, p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_workspace_member(p_workspace_id)
    and exists (
      select 1 from public.transactions t
      where t.id = p_transaction_id and t.workspace_id = p_workspace_id
    );
$$;

-- Prevent moving rows between workspaces (a user in two workspaces could otherwise
-- satisfy both the USING and WITH CHECK clauses).
create or replace function public.prevent_workspace_reassignment()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_reassignment_not_allowed';
  end if;
  return new;
end $$;

create or replace function public.prevent_transaction_reassignment()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.transaction_id is distinct from old.transaction_id then
    raise exception 'transaction_reassignment_not_allowed';
  end if;
  return new;
end $$;

drop trigger if exists junobi_products_lock_workspace on public.products;
create trigger junobi_products_lock_workspace
  before update on public.products
  for each row execute function public.prevent_workspace_reassignment();

drop trigger if exists junobi_transactions_lock_workspace on public.transactions;
create trigger junobi_transactions_lock_workspace
  before update on public.transactions
  for each row execute function public.prevent_workspace_reassignment();

drop trigger if exists junobi_transaction_items_lock_transaction on public.transaction_items;
create trigger junobi_transaction_items_lock_transaction
  before update on public.transaction_items
  for each row execute function public.prevent_transaction_reassignment();

-- 3. RPCs used by the frontend ----------------------------------------------------------
create or replace function public.create_workspace(p_name text)
returns public.workspaces language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_ws public.workspaces;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'invalid_name'; end if;

  -- Serialize per user so concurrent creates/restores cannot exceed the cap.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workspace-limit:' || v_uid::text, 0));

  if public.count_owned_active_workspaces(v_uid) >= 3 then
    raise exception 'workspace_limit_reached';
  end if;

  insert into public.workspaces (name, owner_id) values (v_name, v_uid) returning * into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws.id, v_uid, 'owner');
  return v_ws;
end $$;

-- Owner or Admin. A single "not found" error hides existence from everyone else.
create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns public.workspaces language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_ws public.workspaces;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'invalid_name'; end if;

  update public.workspaces w set name = v_name
  where w.id = p_workspace_id
    and w.deleted_at is null
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = w.id and m.user_id = v_uid and m.role in ('owner', 'admin')
    )
  returning * into v_ws;

  if not found then raise exception 'workspace_not_found'; end if;
  return v_ws;
end $$;

-- Owner only. Only sets deleted_at: no business rows or relations are touched.
create or replace function public.soft_delete_workspace(p_workspace_id uuid)
returns public.workspaces language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  update public.workspaces set deleted_at = now()
  where id = p_workspace_id and owner_id = v_uid and deleted_at is null
  returning * into v_ws;

  if not found then raise exception 'workspace_not_found'; end if;
  return v_ws;
end $$;

-- Owner only, within the retention window, and only if a slot is free.
create or replace function public.restore_workspace(p_workspace_id uuid)
returns public.workspaces language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workspace-limit:' || v_uid::text, 0));

  select * into v_ws from public.workspaces
  where id = p_workspace_id and owner_id = v_uid and deleted_at is not null
  for update;

  if not found then raise exception 'workspace_not_found'; end if;
  if v_ws.deleted_at <= now() - public.workspace_trash_retention() then
    raise exception 'restore_expired';
  end if;
  if public.count_owned_active_workspaces(v_uid) >= 3 then
    raise exception 'workspace_limit_reached';
  end if;

  update public.workspaces set deleted_at = null where id = p_workspace_id returning * into v_ws;
  return v_ws;
end $$;

-- Permanent deletion of expired Trash. Never callable by clients; schedule separately.
-- Deletes workspace by workspace; a workspace whose existing foreign keys forbid the
-- delete (NO ACTION / RESTRICT) is skipped instead of aborting the batch. Existing
-- ON DELETE CASCADE foreign keys WILL delete that workspace's business data.
create or replace function public.purge_expired_workspaces()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.workspaces
    where deleted_at is not null and deleted_at <= now() - public.workspace_trash_retention()
  loop
    begin
      delete from public.workspaces where id = v_id;
      v_count := v_count + 1;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
  return v_count;
end $$;

-- 4. Table privileges and RLS ----------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

-- Column-level grants survive table-level REVOKE, so clear them explicitly first.
do $$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name in ('workspaces', 'workspace_members', 'workspace_invitations',
                           'products', 'transactions', 'transaction_items')
  loop
    execute format('revoke all (%I) on public.%I from public, anon, authenticated', r.column_name, r.table_name);
  end loop;
end $$;

-- workspaces / membership: clients read only; every write goes through the RPCs above.
revoke all on public.workspaces from public, anon;
revoke all on public.workspace_members, public.workspace_invitations from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.workspaces from authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;

-- business tables: start from zero for client roles, then grant exactly what the policies
-- below can further restrict. TRUNCATE / REFERENCES / TRIGGER are never granted.
revoke all on public.products, public.transactions, public.transaction_items from public, anon, authenticated;
grant select, insert, update, delete on public.products, public.transactions, public.transaction_items to authenticated;

-- workspaces policies. Legacy permissive policies are kept; the restrictive guards below
-- make sure they can never widen access beyond owner/member or allow direct writes.
drop policy if exists junobi_workspace_select_guard on public.workspaces;
drop policy if exists junobi_workspace_select on public.workspaces;
drop policy if exists junobi_workspace_insert_guard on public.workspaces;
drop policy if exists junobi_workspace_update_guard on public.workspaces;
drop policy if exists junobi_workspace_delete_guard on public.workspaces;

create policy junobi_workspace_select_guard on public.workspaces
  as restrictive for select to public
  using (owner_id = (select auth.uid()) or public.is_workspace_member(id));
create policy junobi_workspace_select on public.workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_workspace_member(id));
create policy junobi_workspace_insert_guard on public.workspaces
  as restrictive for insert to anon, authenticated with check (false);
create policy junobi_workspace_update_guard on public.workspaces
  as restrictive for update to anon, authenticated using (false) with check (false);
create policy junobi_workspace_delete_guard on public.workspaces
  as restrictive for delete to anon, authenticated using (false);

-- Drop every existing policy (legacy ones included) so none can broaden visibility.
do $$
declare
  r record;
begin
  for r in
    select policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'workspace_members'
  loop
    execute format('drop policy %I on public.workspace_members', r.policyname);
  end loop;
end $$;
create policy junobi_workspace_members_select on public.workspace_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])
  );

-- Business tables: replace ALL existing policies (owner-based ones included; the owner is
-- a member, so owner access is preserved) with the role matrix.
do $$
declare
  r record;
  v_all constant text := 'array[''owner'',''admin'',''manager'',''employee'']::public.workspace_role[]';
  v_write constant text := 'array[''owner'',''admin'',''manager'']::public.workspace_role[]';
  v_item_extra text := '';
  v_tx_extra text := '';
begin
  for r in
    select tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in ('products', 'transactions', 'transaction_items')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  -- products
  execute format('create policy junobi_products_select on public.products for select to authenticated using (public.has_workspace_role(workspace_id, %s))', v_all);
  execute format('create policy junobi_products_insert on public.products for insert to authenticated with check (public.has_workspace_role(workspace_id, %s))', v_write);
  execute format('create policy junobi_products_update on public.products for update to authenticated using (public.has_workspace_role(workspace_id, %s)) with check (public.has_workspace_role(workspace_id, %s))', v_write, v_write);
  execute format('create policy junobi_products_delete on public.products for delete to authenticated using (public.has_workspace_role(workspace_id, %s))', v_write);

  -- transactions: employees may record (insert) and read, never edit or delete
  execute format('create policy junobi_transactions_select on public.transactions for select to authenticated using (public.has_workspace_role(workspace_id, %s))', v_all);
  -- if created_by exists it must equal the caller (NULL is rejected too)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'created_by'
  ) then
    v_tx_extra := ' and created_by = (select auth.uid())';
  end if;
  execute format('create policy junobi_transactions_insert on public.transactions for insert to authenticated with check (public.has_workspace_role(workspace_id, %s)%s)', v_all, v_tx_extra);
  execute format('create policy junobi_transactions_update on public.transactions for update to authenticated using (public.has_workspace_role(workspace_id, %s)) with check (public.has_workspace_role(workspace_id, %s))', v_write, v_write);
  execute format('create policy junobi_transactions_delete on public.transactions for delete to authenticated using (public.has_workspace_role(workspace_id, %s))', v_write);

  -- transaction_items: workspace is always derived from the parent transaction
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transaction_items' and column_name = 'workspace_id'
  ) then
    v_item_extra := ' and public.transaction_in_workspace(transaction_id, workspace_id)';
  end if;
  execute format('create policy junobi_transaction_items_select on public.transaction_items for select to authenticated using (public.has_transaction_role(transaction_id, %s))', v_all);
  execute format('create policy junobi_transaction_items_insert on public.transaction_items for insert to authenticated with check (public.has_transaction_role(transaction_id, %s)%s)', v_all, v_item_extra);
  execute format('create policy junobi_transaction_items_update on public.transaction_items for update to authenticated using (public.has_transaction_role(transaction_id, %s)) with check (public.has_transaction_role(transaction_id, %s)%s)', v_write, v_write, v_item_extra);
  execute format('create policy junobi_transaction_items_delete on public.transaction_items for delete to authenticated using (public.has_transaction_role(transaction_id, %s))', v_write);
end $$;

-- 5. Function privileges ---------------------------------------------------------------
revoke all on function
  public.workspace_trash_retention(),
  public.count_owned_active_workspaces(uuid),
  public.has_workspace_role(uuid, public.workspace_role[]),
  public.is_workspace_member(uuid),
  public.has_transaction_role(uuid, public.workspace_role[]),
  public.transaction_in_workspace(uuid, uuid),
  public.prevent_workspace_reassignment(),
  public.prevent_transaction_reassignment(),
  public.create_workspace(text),
  public.rename_workspace(uuid, text),
  public.soft_delete_workspace(uuid),
  public.restore_workspace(uuid),
  public.purge_expired_workspaces()
from public, anon, authenticated;

-- Called from RLS policies as the signed-in user, and by the frontend RPCs.
grant execute on function
  public.has_workspace_role(uuid, public.workspace_role[]),
  public.is_workspace_member(uuid),
  public.has_transaction_role(uuid, public.workspace_role[]),
  public.transaction_in_workspace(uuid, uuid),
  public.create_workspace(text),
  public.rename_workspace(uuid, text),
  public.soft_delete_workspace(uuid),
  public.restore_workspace(uuid)
to authenticated;

grant execute on function public.purge_expired_workspaces() to service_role;

-- 5b. Post-conditions: abort (rolling back everything) if any permission is wrong.
do $$
declare
  v_tbl text;
  v_priv text;
  v_role text;
begin
  foreach v_tbl in array array['workspaces', 'workspace_members', 'workspace_invitations',
                               'products', 'transactions', 'transaction_items']
  loop
    if not (select relrowsecurity from pg_catalog.pg_class where oid = format('public.%I', v_tbl)::regclass) then
      raise exception 'RLS is not enabled on public.%', v_tbl;
    end if;
    foreach v_role in array array['anon', 'authenticated'] loop
      foreach v_priv in array array['TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(v_role, format('public.%I', v_tbl), v_priv) then
          raise exception '% still has % on public.%', v_role, v_priv, v_tbl;
        end if;
      end loop;
    end loop;
    if has_table_privilege('anon', format('public.%I', v_tbl), 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'anon still has access to public.%', v_tbl;
    end if;
  end loop;

  foreach v_tbl in array array['workspaces', 'workspace_members'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('authenticated', format('public.%I', v_tbl), v_priv) then
        raise exception 'authenticated can still % public.% directly', v_priv, v_tbl;
      end if;
    end loop;
  end loop;

  if has_table_privilege('authenticated', 'public.workspace_invitations', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'authenticated must not access public.workspace_invitations yet';
  end if;

  -- Permanent deletion is service_role only.
  if has_function_privilege('anon', 'public.purge_expired_workspaces()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.purge_expired_workspaces()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.purge_expired_workspaces()', 'EXECUTE') then
    raise exception 'purge_expired_workspaces() must be executable by service_role only';
  end if;
  if has_function_privilege('anon', 'public.create_workspace(text)', 'EXECUTE') then
    raise exception 'anon must not call workspace RPCs';
  end if;
end $$;

commit;

-- 6. OPTIONAL scheduled purge. Needs the pg_cron extension (Dashboard > Database >
--    Extensions). Left commented on purpose: review the foreign keys first.
--
-- select cron.schedule('purge-expired-workspaces', '17 3 * * *',
--   $$ select public.purge_expired_workspaces(); $$);
