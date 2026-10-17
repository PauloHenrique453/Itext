-- Run ONLY in the Supabase SQL Editor as the project owner, AFTER creator-privacy.sql.
-- Replace PREENCHER_USER_UID with your own Google account UID from Authentication > Users.
-- The transaction refuses missing/unverified/non-Google accounts. Never use someone else's UID.
-- The website cannot modify this designation or replace a registered encryption key.
begin;
do $$
declare creator uuid := 'PREENCHER_USER_UID'::uuid;
begin
 if not exists(select 1 from auth.users u where u.id=creator and u.email_confirmed_at is not null
   and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')) then
   raise exception 'Escolha o UID da sua conta Google verificada em Authentication > Users';
 end if;
 insert into public.itext_chat_privacy(singleton,owner_id) values(true,creator);
end;
$$;
commit;
