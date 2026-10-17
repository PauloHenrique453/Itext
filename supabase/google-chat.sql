-- Apply once in your own Supabase project. Social content remains in Cloudflare D1.
create table if not exists public.chat_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.chat_profiles(id) on delete cascade,
  recipient_id uuid not null references public.chat_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint direct_messages_different_people check (sender_id <> recipient_id)
);
create index if not exists direct_messages_conversation_idx on public.direct_messages(sender_id, recipient_id, created_at desc, id);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient_id, created_at desc);

alter table public.chat_profiles enable row level security;
alter table public.direct_messages enable row level security;
revoke all on public.chat_profiles, public.direct_messages from anon, authenticated;
grant select on public.chat_profiles to authenticated;
grant update (name, avatar_url) on public.chat_profiles to authenticated;
grant select on public.direct_messages to authenticated;
grant insert (id, sender_id, recipient_id, body) on public.direct_messages to authenticated;

create policy "members see chat directory" on public.chat_profiles for select to authenticated using (true);
create policy "members edit own chat profile" on public.chat_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "only participants read messages" on public.direct_messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "send only as yourself" on public.direct_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid()));

create function public.create_itext_chat_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_profiles(id, name, avatar_url)
  values(new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Membro do Itext'), 80),
    case when new.raw_user_meta_data->>'avatar_url' like 'https://%' then new.raw_user_meta_data->>'avatar_url' else null end)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_itext_chat_profile() from public, anon, authenticated;
create trigger on_itext_auth_user_created after insert on auth.users
  for each row execute function public.create_itext_chat_profile();

-- Register accounts created before this chat schema was installed.
insert into public.chat_profiles(id,name,avatar_url)
select id, left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), 'Membro do Itext'),80),
  case when raw_user_meta_data->>'avatar_url' like 'https://%' then raw_user_meta_data->>'avatar_url' else null end
from auth.users on conflict (id) do nothing;

-- Supabase Realtime checks the SELECT policy before delivering each row.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages') then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
