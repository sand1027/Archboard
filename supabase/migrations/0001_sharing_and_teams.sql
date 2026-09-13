-- ============================================================================
-- Sharing and teams
-- ============================================================================
--
-- Until now `diagrams.user_id` was the only notion of access: one owner, no way to
-- let anyone else in. This adds two routes to a diagram.
--
--   1. Direct shares — up to 3 collaborators per diagram, capped by trigger.
--   2. Teams — a diagram can belong to a team, and every member gets access.
--
-- The cap lives in the database rather than in application code so it cannot be
-- bypassed by calling the API directly.
--
-- Access is decided by two SECURITY DEFINER helpers. They must be definer-rights:
-- a policy on `diagrams` that queried `diagrams` under RLS would recurse.
--
-- Run this against your Supabase project (SQL editor, or `supabase db push`).
-- ============================================================================

-- ─── teams ──────────────────────────────────────────────────────────────────

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 80),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists teams_owner_idx on public.teams (owner_id);

create table if not exists public.team_members (
  team_id   uuid not null references public.teams (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  -- Team members can edit by default; 'viewer' is for read-only stakeholders.
  role      text not null default 'editor' check (role in ('viewer', 'editor', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on public.team_members (user_id);

-- ─── per-diagram shares ─────────────────────────────────────────────────────

-- `user_id` is null until the invitee has an account. Matching on `invited_email`
-- against the JWT means an invite starts working the moment they sign up, with no
-- separate accept step to get stuck in.
create table if not exists public.diagram_shares (
  id            uuid primary key default gen_random_uuid(),
  diagram_id    uuid not null references public.diagrams (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete cascade,
  invited_email text not null,
  role          text not null default 'editor' check (role in ('viewer', 'editor')),
  invited_by    uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- One row per person per diagram. Case-insensitive, since email is.
  unique (diagram_id, invited_email)
);

create index if not exists diagram_shares_diagram_idx on public.diagram_shares (diagram_id);
create index if not exists diagram_shares_user_idx on public.diagram_shares (user_id);
create index if not exists diagram_shares_email_idx on public.diagram_shares (lower(invited_email));

-- Normalise email on the way in so the unique constraint and lookups agree.
create or replace function public.normalise_share_email()
returns trigger
language plpgsql
as $$
begin
  new.invited_email := lower(trim(new.invited_email));
  return new;
end;
$$;

drop trigger if exists diagram_shares_normalise_email on public.diagram_shares;
create trigger diagram_shares_normalise_email
  before insert or update on public.diagram_shares
  for each row execute function public.normalise_share_email();

-- ─── the collaborator cap ───────────────────────────────────────────────────

-- Three collaborators *in addition to* the owner, so four people on a diagram.
-- Teams are deliberately uncapped: needing more than a handful of people is
-- exactly when you should be using one.
create or replace function public.enforce_diagram_share_limit()
returns trigger
language plpgsql
as $$
declare
  share_count integer;
begin
  select count(*) into share_count
  from public.diagram_shares
  where diagram_id = new.diagram_id;

  if share_count >= 3 then
    raise exception
      'A diagram can be shared with at most 3 collaborators. Create a team to share more widely.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists diagram_shares_limit on public.diagram_shares;
create trigger diagram_shares_limit
  before insert on public.diagram_shares
  for each row execute function public.enforce_diagram_share_limit();

-- ─── diagrams gain a team ───────────────────────────────────────────────────

alter table public.diagrams
  add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists diagrams_team_idx on public.diagrams (team_id);

-- ─── access helpers ─────────────────────────────────────────────────────────

-- SECURITY DEFINER on purpose: these are called from policies on the very tables
-- they read, and running under the caller's RLS would recurse. search_path is
-- pinned so the definer rights cannot be redirected at another schema.

create or replace function public.can_view_diagram(p_diagram_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from diagrams d
      where d.id = p_diagram_id and d.user_id = auth.uid()
    )
    or exists (
      select 1 from diagram_shares s
      where s.diagram_id = p_diagram_id
        and (
          s.user_id = auth.uid()
          or s.invited_email = lower(auth.jwt() ->> 'email')
        )
    )
    or exists (
      select 1
      from diagrams d
      join team_members m on m.team_id = d.team_id
      where d.id = p_diagram_id and m.user_id = auth.uid()
    );
$$;

create or replace function public.can_edit_diagram(p_diagram_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from diagrams d
      where d.id = p_diagram_id and d.user_id = auth.uid()
    )
    or exists (
      select 1 from diagram_shares s
      where s.diagram_id = p_diagram_id
        and s.role = 'editor'
        and (
          s.user_id = auth.uid()
          or s.invited_email = lower(auth.jwt() ->> 'email')
        )
    )
    or exists (
      select 1
      from diagrams d
      join team_members m on m.team_id = d.team_id
      where d.id = p_diagram_id
        and m.user_id = auth.uid()
        and m.role in ('editor', 'admin')
    );
$$;

-- Claim any invites addressed to this user's email. Called after sign-in so a
-- pending share picks up a real user_id once the account exists.
create or replace function public.claim_pending_shares()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  update diagram_shares
  set user_id = auth.uid()
  where user_id is null
    and invited_email = lower(auth.jwt() ->> 'email');

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

-- ─── row level security ─────────────────────────────────────────────────────

alter table public.diagrams       enable row level security;
alter table public.diagram_shares enable row level security;
alter table public.teams          enable row level security;
alter table public.team_members   enable row level security;

-- diagrams -------------------------------------------------------------------

drop policy if exists diagrams_select on public.diagrams;
create policy diagrams_select on public.diagrams
  for select using (can_view_diagram(id));

drop policy if exists diagrams_insert on public.diagrams;
create policy diagrams_insert on public.diagrams
  for insert with check (user_id = auth.uid());

drop policy if exists diagrams_update on public.diagrams;
create policy diagrams_update on public.diagrams
  for update using (can_edit_diagram(id)) with check (can_edit_diagram(id));

-- Only the owner may delete. An editor can change the contents but should not be
-- able to destroy someone else's diagram.
drop policy if exists diagrams_delete on public.diagrams;
create policy diagrams_delete on public.diagrams
  for delete using (user_id = auth.uid());

-- diagram_shares -------------------------------------------------------------

-- Everyone with access can see who else has access; only the owner changes it.
drop policy if exists diagram_shares_select on public.diagram_shares;
create policy diagram_shares_select on public.diagram_shares
  for select using (can_view_diagram(diagram_id));

drop policy if exists diagram_shares_write on public.diagram_shares;
create policy diagram_shares_write on public.diagram_shares
  for all
  using (exists (select 1 from diagrams d where d.id = diagram_id and d.user_id = auth.uid()))
  with check (exists (select 1 from diagrams d where d.id = diagram_id and d.user_id = auth.uid()));

-- teams ----------------------------------------------------------------------

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (
    owner_id = auth.uid()
    or exists (select 1 from team_members m where m.team_id = id and m.user_id = auth.uid())
  );

drop policy if exists teams_insert on public.teams;
create policy teams_insert on public.teams
  for insert with check (owner_id = auth.uid());

drop policy if exists teams_modify on public.teams;
create policy teams_modify on public.teams
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams
  for delete using (owner_id = auth.uid());

-- team_members ---------------------------------------------------------------

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from teams t where t.id = team_id and t.owner_id = auth.uid())
  );

drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members
  for all
  using (exists (select 1 from teams t where t.id = team_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from teams t where t.id = team_id and t.owner_id = auth.uid()));

-- diagram_versions -----------------------------------------------------------
-- Version history follows the diagram: anyone who can view it can read history,
-- anyone who can edit can add to it.

alter table public.diagram_versions enable row level security;

drop policy if exists diagram_versions_select on public.diagram_versions;
create policy diagram_versions_select on public.diagram_versions
  for select using (can_view_diagram(diagram_id));

drop policy if exists diagram_versions_insert on public.diagram_versions;
create policy diagram_versions_insert on public.diagram_versions
  for insert with check (can_edit_diagram(diagram_id));

-- ─── notes ──────────────────────────────────────────────────────────────────
--
-- Live cursors and edit operations travel over Realtime *channels* (presence and
-- broadcast), which need no table replication, so nothing is added to the
-- supabase_realtime publication here. If you later want clients to react to
-- committed row changes, add:
--
--   alter publication supabase_realtime add table public.diagrams;
