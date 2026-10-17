-- Apply once AFTER google-chat.sql, social.sql and creator-privacy.sql.
-- Keep itext_private OUT of the Supabase Data API exposed schemas.
-- Supabase default ACLs grant anon/authenticated directly; revoking PUBLIC alone is insufficient.
begin;
create schema itext_private;
revoke all on schema itext_private from public,anon,authenticated;
grant usage on schema itext_private to anon,authenticated;

-- Narrow, fixed projections deliberately cross RLS without exposing private columns.
create function itext_private.public_profiles() returns table(
 id uuid,name text,avatar_url text,bio text,cover_url text,theme_color text,interests text[],created_at timestamptz
) language sql stable security definer set search_path='' as $$
 select id,name,avatar_url,bio,cover_url,theme_color,interests,created_at from public.chat_profiles;
$$;
revoke all on function itext_private.public_profiles() from public,anon,authenticated;
grant execute on function itext_private.public_profiles() to anon,authenticated;
create or replace view public.itext_public_profiles with(security_invoker=true,security_barrier=true) as
 select * from itext_private.public_profiles();

create function itext_private.chat_public_keys() returns table(user_id uuid,public_key text,fingerprint text)
language sql stable security definer set search_path='' as $$
 select user_id,public_key,fingerprint from public.itext_chat_keys where (select auth.uid()) is not null;
$$;
revoke all on function itext_private.chat_public_keys() from public,anon,authenticated;
grant execute on function itext_private.chat_public_keys() to authenticated;
create or replace view public.itext_chat_public_keys with(security_invoker=true,security_barrier=true) as
 select * from itext_private.chat_public_keys();

-- Base profiles include settings/onboarding, so restrict them to their owner.
-- The public directory above remains limited to the declared public fields.
drop policy "members see chat directory" on public.chat_profiles;
create policy "members read own full profile" on public.chat_profiles for select to authenticated
 using(id=(select auth.uid()));

-- Keep the API contract, but move privileged implementations out of the exposed schema.
-- Each public wrapper runs as the caller; private functions keep their existing checks.
do $$
declare f record; params text; volatility text; moved integer:=0;
begin
 for f in select p.oid,p.proname,p.pronargs,p.provolatile,
   pg_get_function_arguments(p.oid) as args,
   pg_get_function_identity_arguments(p.oid) as identity_args,
   pg_get_function_result(p.oid) as result
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prosecdef and p.proname=any(array[
     'itext_approve_member','itext_can_swipe','itext_create_group','itext_crypto_ready',
     'itext_dating_cards','itext_encryption_ready','itext_group_by_invite','itext_is_creator',
     'itext_join_group','itext_media_readable','itext_member','itext_owner','itext_read_group','itext_read_post'
   ])
 loop
   select coalesce(string_agg('$'||i::text,',' order by i),'') into params from generate_series(1,f.pronargs) i;
   volatility:=case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end;
   execute format('alter function public.%I(%s) set schema itext_private',f.proname,f.identity_args);
   execute format('revoke all on function itext_private.%I(%s) from public,anon,authenticated',f.proname,f.identity_args);
   execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path='''' as %L',
     f.proname,f.args,f.result,volatility,format('select * from itext_private.%I(%s)',f.proname,params));
   execute format('revoke all on function public.%I(%s) from public,anon,authenticated',f.proname,f.identity_args);
   execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.identity_args);
   execute format('grant execute on function itext_private.%I(%s) to authenticated',f.proname,f.identity_args);
   if f.proname=any(array['itext_crypto_ready','itext_group_by_invite','itext_media_readable','itext_member','itext_owner','itext_read_group','itext_read_post']) then
     execute format('grant execute on function public.%I(%s) to anon',f.proname,f.identity_args);
     execute format('grant execute on function itext_private.%I(%s) to anon',f.proname,f.identity_args);
   end if;
   moved:=moved+1;
 end loop;
 if moved<>14 then raise exception 'Expected 14 reviewed implementations, found %',moved; end if;
end;$$;
-- Trigger references follow the function OID; it has no public RPC wrapper.
alter function public.create_itext_chat_profile() set schema itext_private;
revoke all on function itext_private.create_itext_chat_profile() from public,anon,authenticated;

-- Combine message read predicates into one policy, preserving creator and participant access.
drop policy "only participants read messages" on public.direct_messages;
drop policy "declared creator reviews messages" on public.direct_messages;
create policy "participants and declared creator read" on public.direct_messages for select to authenticated using(
 sender_id=(select auth.uid()) or recipient_id=(select auth.uid()) or (select public.itext_is_creator())
);
create index direct_messages_owner_idx on public.direct_messages(owner_id);
create index itext_comments_author_idx on public.itext_comments(author_id);
create index itext_follows_following_idx on public.itext_follows(following_id);
create index itext_groups_owner_idx on public.itext_groups(owner_id);
create index itext_likes_user_idx on public.itext_likes(user_id);
create index itext_pages_owner_idx on public.itext_pages(owner_id);
notify pgrst,'reload schema';
commit;
