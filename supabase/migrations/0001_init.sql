-- Kaderplan – Datenbankschema für Supabase (Postgres)
-- Ausführen: Supabase Dashboard → SQL Editor → Inhalt einfügen → Run
-- oder mit der Supabase CLI: supabase db push

create extension if not exists pgcrypto;

-- Lokales Datum in Deutschland (Server laufen in UTC)
create or replace function public.today_de() returns date
language sql stable as $$ select (now() at time zone 'Europe/Berlin')::date $$;

-- ───────────────────────── Tabellen ─────────────────────────

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  join_code   text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.team_members (
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role         text not null default 'player' check (role in ('coach', 'player')),
  active       boolean not null default true,
  joined_on    date not null default public.today_de(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members(user_id);

-- Feste wöchentliche Trainingszeiten. weekday: 0 = Sonntag … 6 = Samstag
create table public.training_series (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null default 'Training' check (char_length(title) between 1 and 80),
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time,
  location    text check (location is null or char_length(location) <= 120),
  starts_on   date not null default public.today_de(),
  ends_on     date,
  created_at  timestamptz not null default now()
);

-- Einzelne Trainings (aus Serien erzeugt oder als Einzeltermin angelegt)
create table public.trainings (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  series_id     uuid references public.training_series(id) on delete set null,
  date          date not null,
  start_time    time,
  end_time      time,
  location      text check (location is null or char_length(location) <= 120),
  title         text not null default 'Training' check (char_length(title) between 1 and 80),
  cancelled     boolean not null default false,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  created_at    timestamptz not null default now(),
  unique (series_id, date)
);
create index trainings_team_date_idx on public.trainings(team_id, date);

create table public.responses (
  training_id uuid not null references public.trainings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null check (status in ('yes', 'no', 'maybe')),
  reason      text check (reason is null or reason in ('Krank', 'Verletzt', 'Arbeit/Uni', 'Urlaub', 'Privat', 'Sonstiges')),
  comment     text check (comment is null or char_length(comment) <= 300),
  updated_at  timestamptz not null default now(),
  primary key (training_id, user_id)
);
create index responses_user_idx on public.responses(user_id);

create table public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- Merkt sich verschickte Erinnerungen (nur Server/Service-Role)
create table public.reminder_log (
  training_id uuid not null references public.trainings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  primary key (training_id, user_id)
);

-- ───────────────────────── Hilfsfunktionen ─────────────────────────

create or replace function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid() and active)
$$;

create or replace function public.is_coach(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid() and active and role = 'coach')
$$;

create or replace function public.training_team(tr uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from trainings where id = tr
$$;

-- ───────────────────────── Row Level Security ─────────────────────────

alter table public.teams              enable row level security;
alter table public.team_members       enable row level security;
alter table public.training_series    enable row level security;
alter table public.trainings          enable row level security;
alter table public.responses          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log       enable row level security;

create policy teams_select on public.teams for select using (public.is_member(id));
create policy teams_update on public.teams for update using (public.is_coach(id)) with check (public.is_coach(id));

-- Mitglieder sehen ihr Team (auch inaktive Spieler, damit die Statistik vollständig bleibt)
create policy members_select on public.team_members for select using (public.is_member(team_id));
create policy members_update on public.team_members for update using (public.is_coach(team_id)) with check (public.is_coach(team_id));

create policy series_select on public.training_series for select using (public.is_member(team_id));
create policy series_write  on public.training_series for all
  using (public.is_coach(team_id)) with check (public.is_coach(team_id));

create policy trainings_select on public.trainings for select using (public.is_member(team_id));
create policy trainings_write  on public.trainings for all
  using (public.is_coach(team_id)) with check (public.is_coach(team_id));

create policy responses_select on public.responses for select
  using (public.is_member(public.training_team(training_id)));
-- Eigene Antwort oder (als Trainer) für jeden Spieler
create policy responses_insert on public.responses for insert
  with check (
    (user_id = auth.uid() and public.is_member(public.training_team(training_id)))
    or public.is_coach(public.training_team(training_id))
  );
create policy responses_update on public.responses for update
  using (
    (user_id = auth.uid() and public.is_member(public.training_team(training_id)))
    or public.is_coach(public.training_team(training_id))
  )
  with check (
    (user_id = auth.uid() and public.is_member(public.training_team(training_id)))
    or public.is_coach(public.training_team(training_id))
  );
create policy responses_delete on public.responses for delete
  using (user_id = auth.uid() or public.is_coach(public.training_team(training_id)));

create policy push_own on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- reminder_log: keine Policy → nur Service-Role

-- ───────────────────────── RPC-Funktionen ─────────────────────────

create or replace function public.create_team(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  insert into teams (name, created_by) values (trim(p_name), auth.uid()) returning id into t;
  insert into team_members (team_id, user_id, display_name, role) values (t, auth.uid(), trim(p_display_name), 'coach');
  return t;
end $$;

create or replace function public.join_team(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select id into t from teams where join_code = upper(trim(p_code));
  if t is null then raise exception 'Unbekannter Teamcode'; end if;
  insert into team_members (team_id, user_id, display_name)
  values (t, auth.uid(), trim(p_display_name))
  on conflict (team_id, user_id) do update set display_name = excluded.display_name;
  return t;
end $$;

create or replace function public.regenerate_join_code(p_team uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_coach(p_team) then raise exception 'Nur für Trainer'; end if;
  c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  update teams set join_code = c where id = p_team;
  return c;
end $$;

create or replace function public.set_my_name(p_team uuid, p_display_name text) returns void
language sql security definer set search_path = public as $$
  update team_members set display_name = trim(p_display_name)
  where team_id = p_team and user_id = auth.uid();
$$;

-- Erzeugt die Trainings aus den Serien bis p_weeks Wochen im Voraus.
-- Wird beim Öffnen der Terminliste aufgerufen (idempotent).
create or replace function public.ensure_trainings(p_team uuid, p_weeks int default 9) returns void
language plpgsql security definer set search_path = public as $$
declare s record; horizon date := today_de() + p_weeks * 7;
begin
  if not is_member(p_team) then raise exception 'Kein Mitglied'; end if;
  for s in select * from training_series where team_id = p_team loop
    insert into trainings (team_id, series_id, date, start_time, end_time, location, title)
    select p_team, s.id, d::date, s.start_time, s.end_time, s.location, s.title
    from generate_series(s.starts_on, least(coalesce(s.ends_on, horizon), horizon), interval '1 day') d
    where extract(dow from d) = s.weekday
    on conflict (series_id, date) do nothing;

    -- Nach dem Beenden einer Serie: zukünftige Termine ohne Antworten entfernen
    if s.ends_on is not null then
      delete from trainings tr
      where tr.series_id = s.id and tr.date > s.ends_on and tr.date >= today_de()
        and not exists (select 1 from responses r where r.training_id = tr.id);
    end if;
  end loop;
end $$;

grant execute on function public.create_team, public.join_team, public.regenerate_join_code,
  public.set_my_name, public.ensure_trainings, public.is_member, public.is_coach, public.training_team, public.today_de
  to authenticated;
