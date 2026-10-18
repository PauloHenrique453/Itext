-- Standard messages need only authentication. Extra client-side encryption is an explicit opt-in.
-- Existing vaults and encrypted messages are preserved without rewriting or decrypting them.
begin;
alter table public.chat_profiles add column chat_protection_enabled boolean not null default false;
grant update(chat_protection_enabled) on public.chat_profiles to authenticated;

create function itext_private.chat_preferences() returns table(user_id uuid,enabled boolean)
language sql stable security definer set search_path='' as $$
 select id,chat_protection_enabled from public.chat_profiles where (select auth.uid()) is not null;
$$;
revoke all on function itext_private.chat_preferences() from public,anon,authenticated;
grant execute on function itext_private.chat_preferences() to authenticated;
create view public.itext_chat_preferences with(security_invoker=true,security_barrier=true) as select * from itext_private.chat_preferences();
revoke all on public.itext_chat_preferences from public,anon,authenticated;
grant select on public.itext_chat_preferences to authenticated;

create or replace function itext_private.itext_encryption_ready(sender uuid,recipient uuid,creator uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select sender=(select auth.uid())
 and exists(select 1 from public.chat_profiles p where p.id=sender and p.chat_protection_enabled)
 and exists(select 1 from public.chat_profiles p where p.id=recipient and p.chat_protection_enabled)
 and exists(select 1 from public.itext_chat_privacy p where p.owner_id=creator and p.notice_version='creator-access-v1')
 and not exists(select 1 from unnest(array[sender,recipient,creator]) needed(id)
   where not exists(select 1 from public.itext_chat_keys k where k.user_id=needed.id and k.notice_version='creator-access-v1'));
$$;
revoke all on function itext_private.itext_encryption_ready(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function itext_private.itext_encryption_ready(uuid,uuid,uuid) to authenticated;

create policy "send standard as yourself" on public.direct_messages for insert to authenticated with check(
 sender_id=(select auth.uid()) and recipient_id<>(select auth.uid()) and encryption_version=0 and owner_id is null
 and length(trim(body)) between 1 and 4000
);
notify pgrst,'reload schema';
commit;
