-- Account-scoped blocks, 24-hour stories, message requests and owner-only content actions.
begin;
create table public.itext_blocks(
 blocker_id uuid not null references public.chat_profiles(id) on delete cascade,
 blocked_id uuid not null references public.chat_profiles(id) on delete cascade,
 scope text not null check(scope in('chat','all')),created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index itext_blocks_target_idx on public.itext_blocks(blocked_id,blocker_id);
alter table public.itext_blocks enable row level security;
revoke all on public.itext_blocks from public,anon,authenticated;
grant select,insert,delete on public.itext_blocks to authenticated;
grant update(scope) on public.itext_blocks to authenticated;
create policy "own blocks read" on public.itext_blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy "own blocks insert" on public.itext_blocks for insert to authenticated with check(blocker_id=(select auth.uid()));
create policy "own blocks update" on public.itext_blocks for update to authenticated using(blocker_id=(select auth.uid())) with check(blocker_id=(select auth.uid()));
create policy "own blocks delete" on public.itext_blocks for delete to authenticated using(blocker_id=(select auth.uid()));
create function itext_private.blocked_pair(first_id uuid,second_id uuid,all_only boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_blocks b where ((b.blocker_id=first_id and b.blocked_id=second_id) or (b.blocker_id=second_id and b.blocked_id=first_id)) and (not all_only or b.scope='all'));
$$;
revoke all on function itext_private.blocked_pair(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function itext_private.blocked_pair(uuid,uuid,boolean) to anon,authenticated;
create function public.itext_can_message(partner_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and partner_id<>(select auth.uid()) and not itext_private.blocked_pair((select auth.uid()),partner_id,false);
$$;
revoke all on function public.itext_can_message(uuid) from public,anon,authenticated;
grant execute on function public.itext_can_message(uuid) to authenticated;

-- Search/profile photos remain visible. Full blocks remove the public biography/interests.
create or replace function itext_private.public_profiles() returns table(id uuid,name text,avatar_url text,bio text,cover_url text,theme_color text,interests text[],created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.avatar_url,case when itext_private.blocked_pair((select auth.uid()),p.id,true) then '' else p.bio end,
 p.cover_url,p.theme_color,case when itext_private.blocked_pair((select auth.uid()),p.id,true) then '{}'::text[] else p.interests end,p.created_at from public.chat_profiles p;
$$;
create or replace function itext_private.itext_read_post(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_posts p where p.id=pid and (p.group_id is null or public.itext_read_group(p.group_id)) and not itext_private.blocked_pair((select auth.uid()),p.author_id,true));
$$;
drop policy "visible posts" on public.itext_posts;
create policy "visible posts" on public.itext_posts for select to anon,authenticated using((group_id is null or public.itext_read_group(group_id)) and not itext_private.blocked_pair((select auth.uid()),author_id,true));
drop policy "visible comments" on public.itext_comments;
create policy "visible comments" on public.itext_comments for select to anon,authenticated using(public.itext_read_post(post_id) and not itext_private.blocked_pair((select auth.uid()),author_id,true));
create policy "block follow interactions" on public.itext_follows as restrictive for insert to authenticated with check(not itext_private.blocked_pair(follower_id,following_id,true));

alter table public.itext_posts add column edited_at timestamptz;
grant update(text,code,media,categories,tags) on public.itext_posts to authenticated;
grant delete on public.itext_posts to authenticated;
create policy "edit own post" on public.itext_posts for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()) and public.itext_media_owned(media,(select auth.uid())));
create policy "delete own post" on public.itext_posts for delete to authenticated using(author_id=(select auth.uid()));
create function itext_private.stamp_post_edit() returns trigger language plpgsql set search_path='' as $$begin new.edited_at=clock_timestamp();return new;end;$$;
revoke all on function itext_private.stamp_post_edit() from public,anon,authenticated;
create trigger itext_stamp_post_edit before update on public.itext_posts for each row execute function itext_private.stamp_post_edit();

create table public.itext_stories(
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.chat_profiles(id) on delete cascade,
 media_path text not null,media_type text not null check(media_type in('image','video')),caption text not null default '' check(length(caption)<=280),
 created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'),deleted_at timestamptz,
 check(split_part(media_path,'/',1)=author_id::text and position('..' in media_path)=0),check(expires_at=created_at+interval '24 hours')
);
create index itext_stories_author_idx on public.itext_stories(author_id,created_at desc);
create index itext_stories_active_idx on public.itext_stories(expires_at,author_id);
alter table public.itext_stories enable row level security;
revoke all on public.itext_stories from public,anon,authenticated;
grant select on public.itext_stories to authenticated;
grant insert(author_id,media_path,media_type,caption) on public.itext_stories to authenticated;
create function itext_private.story_readable(story_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.itext_stories s where s.id=story_id and s.deleted_at is null and s.expires_at>now() and not itext_private.blocked_pair((select auth.uid()),s.author_id,true));
$$;
revoke all on function itext_private.story_readable(uuid) from public,anon,authenticated;
grant execute on function itext_private.story_readable(uuid) to authenticated;
create policy "visible active stories" on public.itext_stories for select to authenticated using(deleted_at is null and expires_at>now() and not itext_private.blocked_pair((select auth.uid()),author_id,true));
create policy "publish own story" on public.itext_stories for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='itext-media' and o.name=media_path));
create table public.itext_story_likes(story_id uuid not null references public.itext_stories(id) on delete cascade,user_id uuid not null references public.chat_profiles(id) on delete cascade,primary key(story_id,user_id));
create index itext_story_likes_user_idx on public.itext_story_likes(user_id,story_id);
alter table public.itext_story_likes enable row level security;
revoke all on public.itext_story_likes from public,anon,authenticated;
grant select,insert,delete on public.itext_story_likes to authenticated;
create policy "active story likes" on public.itext_story_likes for select to authenticated using(user_id=(select auth.uid()) and itext_private.story_readable(story_id));
create policy "own story like" on public.itext_story_likes for insert to authenticated with check(user_id=(select auth.uid()) and itext_private.story_readable(story_id));
create policy "remove own story like" on public.itext_story_likes for delete to authenticated using(user_id=(select auth.uid()));

create table public.itext_conversation_settings(
 user_id uuid not null references public.chat_profiles(id) on delete cascade,partner_id uuid not null references public.chat_profiles(id) on delete cascade,
 accepted boolean not null default false,cleared_at timestamptz not null default '-infinity',primary key(user_id,partner_id),check(user_id<>partner_id)
);
create index itext_conversation_settings_partner_idx on public.itext_conversation_settings(partner_id);
alter table public.itext_conversation_settings enable row level security;
revoke all on public.itext_conversation_settings from public,anon,authenticated;
grant select on public.itext_conversation_settings to authenticated;
create policy "own conversation settings" on public.itext_conversation_settings for select to authenticated using(user_id=(select auth.uid()));
alter table public.direct_messages add column reply_to uuid references public.direct_messages(id),add column story_id uuid references public.itext_stories(id),add column edited_at timestamptz,add column deleted_at timestamptz,add column reaction_updated_at timestamptz;
grant insert(reply_to,story_id) on public.direct_messages to authenticated;
create index direct_messages_reply_idx on public.direct_messages(reply_to);
create index direct_messages_story_idx on public.direct_messages(story_id);
create table public.itext_message_hides(user_id uuid not null references public.chat_profiles(id) on delete cascade,message_id uuid not null references public.direct_messages(id) on delete cascade,primary key(user_id,message_id));
create index itext_message_hides_message_idx on public.itext_message_hides(message_id);
alter table public.itext_message_hides enable row level security;
revoke all on public.itext_message_hides from public,anon,authenticated;
grant select on public.itext_message_hides to authenticated;
create policy "own hidden messages" on public.itext_message_hides for select to authenticated using(user_id=(select auth.uid()));
drop policy "participants and declared creator read" on public.direct_messages;
create policy "visible participants and creator review" on public.direct_messages for select to authenticated using(
 ((sender_id=(select auth.uid()) or recipient_id=(select auth.uid()))
 and created_at>coalesce((select c.cleared_at from public.itext_conversation_settings c where c.user_id=(select auth.uid()) and c.partner_id=case when sender_id=(select auth.uid()) then recipient_id else sender_id end),'-infinity'::timestamptz)
 and not exists(select 1 from public.itext_message_hides h where h.user_id=(select auth.uid()) and h.message_id=id))
 or ((select public.itext_is_creator()) and sender_id<>(select auth.uid()) and recipient_id<>(select auth.uid()))
);
create policy "contact not blocked" on public.direct_messages as restrictive for insert to authenticated with check(not itext_private.blocked_pair(sender_id,recipient_id,false));
create function itext_private.validate_message_context() returns trigger language plpgsql security definer set search_path='' as $$
declare target public.direct_messages; st public.itext_stories; sender uuid:=(select auth.uid());
begin
 if new.reply_to is not null then
  select * into target from public.direct_messages where id=new.reply_to;
  if not found or target.deleted_at is not null or not ((target.sender_id=new.sender_id and target.recipient_id=new.recipient_id) or (target.sender_id=new.recipient_id and target.recipient_id=new.sender_id)) then raise exception 'Resposta não pertence a esta conversa.';end if;
 end if;
 if new.story_id is not null then
  select * into st from public.itext_stories where id=new.story_id;
  if not found or st.author_id<>new.recipient_id or not itext_private.story_readable(new.story_id) then raise exception 'Story indisponível para responder.';end if;
 end if;
 return new;
end;$$;
revoke all on function itext_private.validate_message_context() from public,anon,authenticated;
create trigger itext_validate_message_context before insert on public.direct_messages for each row execute function itext_private.validate_message_context();
create function itext_private.accept_outgoing_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.itext_conversation_settings(user_id,partner_id,accepted) values(new.sender_id,new.recipient_id,true)
 on conflict(user_id,partner_id) do update set accepted=true;
 return new;
end;$$;
revoke all on function itext_private.accept_outgoing_conversation() from public,anon,authenticated;
create trigger itext_accept_outgoing after insert on public.direct_messages for each row execute function itext_private.accept_outgoing_conversation();
insert into public.itext_conversation_settings(user_id,partner_id,accepted)
 select distinct sender_id,recipient_id,true from public.direct_messages on conflict do nothing;

create table public.itext_message_reactions(message_id uuid not null references public.direct_messages(id) on delete cascade,user_id uuid not null references public.chat_profiles(id) on delete cascade,emoji text not null default '❤️' check(emoji in('❤️','👍','😂','🎉','🙏','😮')),primary key(message_id,user_id));
create index itext_message_reactions_user_idx on public.itext_message_reactions(user_id);
alter table public.itext_message_reactions enable row level security;
revoke all on public.itext_message_reactions from public,anon,authenticated;
grant select,insert,delete on public.itext_message_reactions to authenticated;
grant update(emoji) on public.itext_message_reactions to authenticated;
create policy "participants read reactions" on public.itext_message_reactions for select to authenticated using(exists(select 1 from public.direct_messages m where m.id=message_id and (m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid()))));
create policy "own authorized reaction" on public.itext_message_reactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.direct_messages m where m.id=message_id and m.deleted_at is null and (m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid())) and not itext_private.blocked_pair(m.sender_id,m.recipient_id,false)));
create policy "edit own reaction" on public.itext_message_reactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.direct_messages m where m.id=message_id and m.deleted_at is null and not itext_private.blocked_pair(m.sender_id,m.recipient_id,false)));
create policy "delete own reaction" on public.itext_message_reactions for delete to authenticated using(user_id=(select auth.uid()));

create function itext_private.conversation_action(partner_id uuid,action text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());
begin
 if uid is null or uid=partner_id or action not in('accept','clear') or not exists(select 1 from public.chat_profiles where id=partner_id) then raise exception 'Conversa inválida.';end if;
 insert into public.itext_conversation_settings(user_id,partner_id,accepted,cleared_at) values(uid,partner_id,action='accept',case when action='clear' then clock_timestamp() else '-infinity'::timestamptz end)
 on conflict on constraint itext_conversation_settings_pkey do update set accepted=case when action='accept' then true else itext_conversation_settings.accepted end,cleared_at=case when action='clear' then clock_timestamp() else itext_conversation_settings.cleared_at end;
end;$$;
create function public.itext_conversation_action(partner_id uuid,action text) returns void language sql security invoker set search_path='' as $$select itext_private.conversation_action(partner_id,action);$$;
create function itext_private.message_action(message_id uuid,action text,new_body text default null,new_version smallint default null,new_owner uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());m public.direct_messages;
begin
 if uid is null then raise exception 'Entre na sua conta.';end if;
 select * into m from public.direct_messages where id=message_id for update;
 if not found or (m.sender_id<>uid and m.recipient_id<>uid) then raise exception 'Mensagem não encontrada.';end if;
 if action='hide' then insert into public.itext_message_hides(user_id,message_id) values(uid,m.id) on conflict do nothing;return;end if;
 if m.sender_id<>uid or m.deleted_at is not null then raise exception 'Apenas o remetente pode alterar esta mensagem.';end if;
 if action='delete' then
  update public.direct_messages set body='Mensagem apagada',encryption_version=0,owner_id=null,deleted_at=clock_timestamp(),edited_at=null where id=m.id;
  delete from public.itext_message_reactions r where r.message_id=m.id;
 elsif action='edit' then
  if itext_private.blocked_pair(m.sender_id,m.recipient_id,false) then raise exception 'Contato bloqueado.';end if;
  if new_version is distinct from m.encryption_version or new_owner is distinct from m.owner_id or new_body is null or length(trim(new_body))<1 or (new_version=0 and length(new_body)>4000) or (new_version=1 and (length(new_body)>65536 or new_body not like '-----BEGIN PGP MESSAGE-----%')) then raise exception 'Edição inválida ou alteração do tipo de proteção.';end if;
  update public.direct_messages set body=new_body,edited_at=clock_timestamp() where id=m.id;
 else raise exception 'Ação inválida.';end if;
end;$$;
create function public.itext_message_action(message_id uuid,action text,new_body text default null,new_version smallint default null,new_owner uuid default null) returns void language sql security invoker set search_path='' as $$select itext_private.message_action(message_id,action,new_body,new_version,new_owner);$$;
create function itext_private.delete_story(story_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Entre na sua conta.';end if;
 update public.itext_stories set deleted_at=clock_timestamp() where id=story_id and author_id=(select auth.uid());
 if not found then raise exception 'Story não encontrado.';end if;
end;$$;
create function public.itext_delete_story(story_id uuid) returns void language sql security invoker set search_path='' as $$select itext_private.delete_story(story_id);$$;
revoke all on function itext_private.conversation_action(uuid,text),public.itext_conversation_action(uuid,text),itext_private.message_action(uuid,text,text,smallint,uuid),public.itext_message_action(uuid,text,text,smallint,uuid),itext_private.delete_story(uuid),public.itext_delete_story(uuid) from public,anon,authenticated;
grant execute on function itext_private.conversation_action(uuid,text),public.itext_conversation_action(uuid,text),itext_private.message_action(uuid,text,text,smallint,uuid),public.itext_message_action(uuid,text,text,smallint,uuid),itext_private.delete_story(uuid),public.itext_delete_story(uuid) to authenticated;

create or replace view public.itext_chat_inbox with(security_invoker=true) as
 with visible as (
  select m.*,case when m.sender_id=(select auth.uid()) then m.recipient_id else m.sender_id end as partner
  from public.direct_messages m where m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid())
 ), grouped as (
  select m.partner as partner_id,max(m.created_at) as last_message_at,
   count(*) filter(where m.deleted_at is null and m.recipient_id=(select auth.uid()) and (r.last_read_at is null or (m.created_at,m.id)>(r.last_read_at,r.last_read_id)))::integer as unread
  from visible m left join public.itext_conversation_reads r on r.user_id=(select auth.uid()) and r.partner_id=m.partner group by m.partner
 )
 select g.partner_id,g.last_message_at,g.unread,
 (not coalesce(c.accepted,false) and not exists(select 1 from public.itext_follows f where (f.follower_id=(select auth.uid()) and f.following_id=g.partner_id) or (f.following_id=(select auth.uid()) and f.follower_id=g.partner_id))) as unknown
 from grouped g left join public.itext_conversation_settings c on c.user_id=(select auth.uid()) and c.partner_id=g.partner_id;

-- Private storage follows current account blocks. Profile photo and cover are the explicit exception.
create or replace function itext_private.itext_media_readable(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(object_name,'/',1)=(select auth.uid())::text
 or exists(select 1 from public.chat_profiles where avatar_url='itext-media:'||object_name or cover_url='itext-media:'||object_name)
 or exists(select 1 from public.itext_posts where media @> jsonb_build_array(jsonb_build_object('storagePath',object_name)) and public.itext_read_post(id))
 or exists(select 1 from public.itext_posts where group_id is null and media @> jsonb_build_array(jsonb_build_object('storagePath',object_name,'type','image')))
 or exists(select 1 from public.itext_stories where media_path=object_name and (select auth.uid()) is not null and itext_private.story_readable(id))
 or ((select auth.uid()) is not null and exists(select 1 from public.itext_dating where discovery_enabled and 'itext-media:'||object_name=any(photos) and not itext_private.blocked_pair((select auth.uid()),user_id,true)));
$$;
-- Public profile photo gallery is the explicit full-block exception; no captions, videos or private group files.
create function itext_private.profile_photos(profile_id uuid,before_at timestamptz default null,before_id uuid default null)
returns table(post_id uuid,media jsonb,created_at timestamptz) language sql stable security definer set search_path='' as $$
 select p.id,(select jsonb_agg(jsonb_build_object('type','image','url',item->>'url','storagePath',item->>'storagePath')) from jsonb_array_elements(p.media) item where item->>'type'='image'),p.created_at
 from public.itext_posts p where (select auth.uid()) is not null and p.author_id=profile_id and p.group_id is null
 and exists(select 1 from jsonb_array_elements(p.media) item where item->>'type'='image')
 and (before_at is null or (p.created_at,p.id)<(before_at,before_id)) order by p.created_at desc,p.id desc limit 40;
$$;
create function public.itext_profile_photos(profile_id uuid,before_at timestamptz default null,before_id uuid default null)
returns table(post_id uuid,media jsonb,created_at timestamptz) language sql stable security invoker set search_path='' as $$select * from itext_private.profile_photos(profile_id,before_at,before_id);$$;
revoke all on function itext_private.profile_photos(uuid,timestamptz,uuid),public.itext_profile_photos(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function itext_private.profile_photos(uuid,timestamptz,uuid),public.itext_profile_photos(uuid,timestamptz,uuid) to authenticated;
create function itext_private.story_like_count(story_id uuid) returns integer language sql stable security definer set search_path='' as $$
 select case when itext_private.story_readable(story_id) then (select count(*)::integer from public.itext_story_likes l where l.story_id=story_like_count.story_id) else 0 end;
$$;
revoke all on function itext_private.story_like_count(uuid) from public,anon,authenticated;
grant execute on function itext_private.story_like_count(uuid) to authenticated;
create view public.itext_story_counts with(security_invoker=true) as select s.id,itext_private.story_like_count(s.id) as likes from public.itext_stories s;
revoke all on public.itext_story_counts from public,anon,authenticated;
grant select on public.itext_story_counts to authenticated;
create or replace function itext_private.likes_visible(profile_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select (p.likes_public or p.id=(select auth.uid())) and not itext_private.blocked_pair((select auth.uid()),p.id,true) from public.chat_profiles p where p.id=profile_id),false);
$$;
create or replace function itext_private.itext_dating_cards() returns table(
 id uuid,name text,avatar text,bio text,city text,age integer,interests text[],photos text[],looking_for text,distance_label text,matched boolean,swiped boolean
) language sql stable security definer set search_path='' as $$
 select d.user_id,p.name,p.avatar_url,d.bio,d.city,date_part('year',age(d.birth_date))::integer,d.interests,d.photos,d.looking_for,
 case when own.latitude is null or own.longitude is null or d.latitude is null or d.longitude is null then d.city
 when sqrt(power((own.latitude-d.latitude)*111,2)+power((own.longitude-d.longitude)*111*cos(radians(own.latitude::float)),2))<50 then 'a menos de 50 km (aproximado)' else 'a mais de 50 km (aproximado)' end,
 exists(select 1 from public.itext_swipes mine join public.itext_swipes theirs on theirs.user_id=mine.candidate_id and theirs.candidate_id=mine.user_id where mine.user_id=auth.uid() and mine.candidate_id=d.user_id and mine.action='like' and theirs.action='like'),
 exists(select 1 from public.itext_swipes s where s.user_id=auth.uid() and s.candidate_id=d.user_id)
 from public.itext_dating d join public.chat_profiles p on p.id=d.user_id join public.itext_dating own on own.user_id=auth.uid()
 where d.user_id<>auth.uid() and d.discovery_enabled and not itext_private.blocked_pair((select auth.uid()),d.user_id,true) order by cardinality(array(select unnest(d.interests) intersect select unnest(own.interests))) desc limit 80;
$$;
-- Emit reaction changes through the already authorized parent message UPDATE stream.
-- Publishing reaction DELETE events directly would expose primary keys without RLS filtering.
create function itext_private.signal_message_reaction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.direct_messages set reaction_updated_at=clock_timestamp() where id=case when tg_op='DELETE' then old.message_id else new.message_id end;
 return null;
end;$$;
revoke all on function itext_private.signal_message_reaction() from public,anon,authenticated;
create trigger itext_signal_message_reaction after insert or update or delete on public.itext_message_reactions for each row execute function itext_private.signal_message_reaction();
notify pgrst,'reload schema';
commit;
