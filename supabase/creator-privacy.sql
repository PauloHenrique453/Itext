-- Apply once AFTER google-chat.sql and social.sql. Existing plaintext is retained as legacy.
-- No owner account is chosen automatically. Configure it with activate-creator.sql.
begin;
create table public.itext_chat_privacy (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null unique references auth.users(id),
  notice_version text not null default 'creator-access-v1' check (notice_version = 'creator-access-v1')
);
create table public.itext_chat_keys (
  user_id uuid primary key references public.chat_profiles(id) on delete cascade,
  public_key text not null check (length(public_key) between 100 and 16384 and public_key like '-----BEGIN PGP PUBLIC KEY BLOCK-----%'),
  encrypted_private_key text not null check (length(encrypted_private_key) between 100 and 32768 and encrypted_private_key like '-----BEGIN PGP PRIVATE KEY BLOCK-----%'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{40,64}$'),
  notice_version text not null check (notice_version = 'creator-access-v1'),
  created_at timestamptz not null default now()
);
alter table public.itext_chat_privacy enable row level security;
alter table public.itext_chat_keys enable row level security;
revoke all on public.itext_chat_privacy, public.itext_chat_keys from public,anon,authenticated;
grant select on public.itext_chat_privacy to authenticated;
grant select on public.itext_chat_keys to authenticated;
grant insert(user_id,public_key,encrypted_private_key,fingerprint,notice_version) on public.itext_chat_keys to authenticated;
create policy "members see declared creator" on public.itext_chat_privacy for select to authenticated using(true);
create policy "only own encrypted key vault" on public.itext_chat_keys for select to authenticated using(user_id=(select auth.uid()));
create policy "register own key once after consent" on public.itext_chat_keys for insert to authenticated with check(
  user_id=(select auth.uid()) and exists(select 1 from public.itext_chat_privacy)
);
-- Deliberately projects ONLY public keys. Private vaults stay behind their own RLS.
create view public.itext_chat_public_keys with (security_barrier=true) as
  select user_id,public_key,fingerprint from public.itext_chat_keys;
revoke all on public.itext_chat_public_keys from public,anon,authenticated;
grant select on public.itext_chat_public_keys to authenticated;

alter table public.direct_messages add column encryption_version smallint not null default 0;
alter table public.direct_messages add column owner_id uuid references auth.users(id);
alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages add constraint direct_messages_body_size check(length(trim(body)) between 1 and 65536);
alter table public.direct_messages add constraint direct_messages_encrypted_format check(
  (encryption_version=0 and owner_id is null) or
  (encryption_version=1 and owner_id is not null and body like '-----BEGIN PGP MESSAGE-----%')
);
grant insert(encryption_version,owner_id) on public.direct_messages to authenticated;
-- This function returns a boolean only; it cannot promote or change an account.
create function public.itext_is_creator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_chat_privacy where owner_id=(select auth.uid()));
$$;
revoke all on function public.itext_is_creator() from public,anon;
grant execute on function public.itext_is_creator() to authenticated;
create policy "declared creator reviews messages" on public.direct_messages for select to authenticated using((select public.itext_is_creator()));

-- Replaces the plaintext insert policy. Existing messages remain readable, new plaintext is refused.
drop policy "send only as yourself" on public.direct_messages;
create function public.itext_encryption_ready(sender uuid,recipient uuid,creator uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select sender=(select auth.uid()) and exists(select 1 from public.itext_chat_privacy p
   where p.owner_id=creator and p.notice_version='creator-access-v1')
   and not exists(select 1 from unnest(array[sender,recipient,creator]) needed(id)
     where not exists(select 1 from public.itext_chat_keys k where k.user_id=needed.id and k.notice_version='creator-access-v1'));
$$;
revoke all on function public.itext_encryption_ready(uuid,uuid,uuid) from public,anon;
grant execute on function public.itext_encryption_ready(uuid,uuid,uuid) to authenticated;
create policy "send encrypted with declared creator" on public.direct_messages for insert to authenticated with check(
  sender_id=(select auth.uid()) and recipient_id<>(select auth.uid()) and encryption_version=1
  and public.itext_encryption_ready(sender_id,recipient_id,owner_id)
);
-- Safe anonymous deployment probe: exposes readiness only, no identity or keys.
create function public.itext_crypto_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_chat_privacy p join public.itext_chat_keys k on k.user_id=p.owner_id);
$$;
revoke all on function public.itext_crypto_ready() from public;
grant execute on function public.itext_crypto_ready() to anon,authenticated;
commit;
