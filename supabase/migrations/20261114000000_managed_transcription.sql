create table if not exists public.plans (
  id text primary key,
  daily_limit integer not null check (daily_limit > 0),
  stripe_price_id text unique,
  created_at timestamptz not null default now()
);

insert into public.plans (id, daily_limit)
values ('free', 5), ('pro', 100)
on conflict (id) do update set daily_limit = excluded.daily_limit;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id) default 'free',
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcription_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  usage_date date not null default current_date,
  audio_bytes integer not null check (audio_bytes > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 600),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index if not exists transcription_usage_daily_idx
  on public.transcription_usage (user_id, usage_date);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  status text not null,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.transcription_usage enable row level security;
alter table public.subscriptions enable row level security;

create policy "plans are readable" on public.plans for select to authenticated using (true);
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "users read own usage" on public.transcription_usage for select to authenticated using (auth.uid() = user_id);
create policy "users read own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare result public.profiles;
begin
  insert into public.profiles (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into result from public.profiles where user_id = auth.uid();
  return result;
end;
$$;

create or replace function public.reserve_transcription(
  p_user_id uuid,
  p_request_id uuid,
  p_audio_bytes integer,
  p_duration_seconds integer default null
)
returns table (accepted boolean, plan_id text, used_today integer, daily_limit integer, remaining integer, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  plan_row public.plans;
  existing public.transcription_usage;
  count_today integer;
begin
  if p_user_id is null then raise exception 'not authenticated'; end if;
  if p_audio_bytes <= 0 or p_audio_bytes > 10485760 then raise exception 'audio size limit exceeded'; end if;
  if p_duration_seconds is not null and (p_duration_seconds < 0 or p_duration_seconds > 600) then raise exception 'audio duration limit exceeded'; end if;
  insert into public.profiles (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into profile_row from public.profiles where user_id = p_user_id for update;
  select * into plan_row from public.plans where id = profile_row.plan_id;
  select * into existing from public.transcription_usage where user_id = p_user_id and request_id = p_request_id;
  if existing.id is not null then
    select count(*) into count_today from public.transcription_usage
      where user_id = p_user_id and usage_date = current_date and status <> 'failed';
    return query select true, plan_row.id, count_today, plan_row.daily_limit,
      greatest(plan_row.daily_limit - count_today, 0), true;
    return;
  end if;
  select count(*) into count_today from public.transcription_usage
    where user_id = p_user_id and usage_date = current_date and status <> 'failed';
  if count_today >= plan_row.daily_limit then
    return query select false, plan_row.id, count_today, plan_row.daily_limit, 0, false;
    return;
  end if;
  insert into public.transcription_usage (user_id, request_id, audio_bytes, duration_seconds)
    values (p_user_id, p_request_id, p_audio_bytes, p_duration_seconds);
  count_today := count_today + 1;
  return query select true, plan_row.id, count_today, plan_row.daily_limit,
    greatest(plan_row.daily_limit - count_today, 0), false;
end;
$$;

create or replace function public.finish_transcription(p_request_id uuid, p_success boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.transcription_usage
  set status = case when p_success then 'completed' else 'failed' end
  where user_id = auth.uid() and request_id = p_request_id;
$$;
