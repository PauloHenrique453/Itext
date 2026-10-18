begin;
-- Comment references are immutable and checked against the actual visible parent.
alter table public.itext_comments add column parent_id uuid references public.itext_comments(id) on delete cascade;
create index itext_comments_parent_idx on public.itext_comments(parent_id);
revoke insert on public.itext_comments from authenticated;
grant insert(id,post_id,author_id,text,parent_id) on public.itext_comments to authenticated;
create function itext_private.comment_readable(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_comments c where c.id=cid and public.itext_read_post(c.post_id) and not itext_private.blocked_pair((select auth.uid()),c.author_id,true));
$$;
revoke all on function itext_private.comment_readable(uuid) from public,anon,authenticated;
grant execute on function itext_private.comment_readable(uuid) to anon,authenticated;
create function itext_private.validate_comment_reply() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.parent_id is not null and not exists(select 1 from public.itext_comments c where c.id=new.parent_id and c.post_id=new.post_id and itext_private.comment_readable(c.id)) then raise exception 'Comentário de resposta indisponível nesta publicação.';end if;
 return new;
end;$$;
revoke all on function itext_private.validate_comment_reply() from public,anon,authenticated;
create trigger itext_validate_comment_reply before insert on public.itext_comments for each row execute function itext_private.validate_comment_reply();
create table public.itext_comment_likes(comment_id uuid not null references public.itext_comments(id) on delete cascade,user_id uuid not null references public.chat_profiles(id) on delete cascade,primary key(comment_id,user_id));
create index itext_comment_likes_user_idx on public.itext_comment_likes(user_id);
alter table public.itext_comment_likes enable row level security;
revoke all on public.itext_comment_likes from public,anon,authenticated;
grant select,insert,delete on public.itext_comment_likes to authenticated;
create policy "own comment likes read" on public.itext_comment_likes for select to authenticated using(user_id=(select auth.uid()) and itext_private.comment_readable(comment_id));
create policy "own readable comment like" on public.itext_comment_likes for insert to authenticated with check(user_id=(select auth.uid()) and itext_private.comment_readable(comment_id));
create policy "remove own comment like" on public.itext_comment_likes for delete to authenticated using(user_id=(select auth.uid()));
create function itext_private.comment_like_count(cid uuid) returns integer language sql stable security definer set search_path='' as $$select case when itext_private.comment_readable(cid) then (select count(*)::integer from public.itext_comment_likes where comment_id=cid) else 0 end;$$;
revoke all on function itext_private.comment_like_count(uuid) from public,anon,authenticated;
grant execute on function itext_private.comment_like_count(uuid) to anon,authenticated;
create view public.itext_comment_counts with(security_invoker=true) as select c.id,itext_private.comment_like_count(c.id) as likes from public.itext_comments c;
revoke all on public.itext_comment_counts from public,anon,authenticated;
grant select on public.itext_comment_counts to anon,authenticated;

-- Server-timestamped leases, one per open browser tab. No client can set another account's status.
create table public.itext_presence(user_id uuid not null references public.chat_profiles(id) on delete cascade,session_id uuid not null,last_seen timestamptz not null default now(),primary key(user_id,session_id));
alter table public.itext_presence enable row level security;
revoke all on public.itext_presence from public,anon,authenticated;
grant select on public.itext_presence to authenticated;
create policy "own presence lease" on public.itext_presence for select to authenticated using(user_id=(select auth.uid()));
create function itext_private.heartbeat(device_id uuid,active boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());
begin
 if uid is null or device_id is null or active is null then raise exception 'Sessão inválida.';end if;
 if active then
  delete from public.itext_presence where user_id=uid and last_seen<now()-interval '1 day';
  insert into public.itext_presence(user_id,session_id,last_seen) values(uid,device_id,clock_timestamp()) on conflict(user_id,session_id) do update set last_seen=clock_timestamp();
 else delete from public.itext_presence where user_id=uid and session_id=device_id;end if;
end;$$;
create function public.itext_heartbeat(device_id uuid,active boolean) returns void language sql security invoker set search_path='' as $$select itext_private.heartbeat(device_id,active);$$;
create function itext_private.online_status(profile_ids uuid[]) returns table(user_id uuid,online boolean) language sql stable security definer set search_path='' as $$
 select p.id,not itext_private.blocked_pair((select auth.uid()),p.id,false) and exists(select 1 from public.itext_presence s where s.user_id=p.id and s.last_seen>now()-interval '90 seconds')
 from public.chat_profiles p where (select auth.uid()) is not null and p.id=any(profile_ids[1:200]);
$$;
create function public.itext_online_status(profile_ids uuid[]) returns table(user_id uuid,online boolean) language sql stable security invoker set search_path='' as $$select * from itext_private.online_status(profile_ids);$$;
create function public.itext_profile_content_visible(profile_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select (select auth.uid()) is not null and not itext_private.blocked_pair((select auth.uid()),profile_id,true);$$;
revoke all on function itext_private.heartbeat(uuid,boolean),public.itext_heartbeat(uuid,boolean),itext_private.online_status(uuid[]),public.itext_online_status(uuid[]),public.itext_profile_content_visible(uuid) from public,anon,authenticated;
grant execute on function itext_private.heartbeat(uuid,boolean),public.itext_heartbeat(uuid,boolean),itext_private.online_status(uuid[]),public.itext_online_status(uuid[]),public.itext_profile_content_visible(uuid) to authenticated;

-- Thumbnail/cover ownership applies to both creation and editing.
alter table public.itext_groups add column avatar_url text,add column cover_url text,add column category text not null default 'Não definido' check(length(trim(category)) between 1 and 60);
alter table public.itext_pages add column cover_url text,alter column category set default 'Não definido';
alter table public.itext_groups add constraint itext_group_avatar_owned check(avatar_url is null or (avatar_url like 'itext-media:%' and split_part(substr(avatar_url,13),'/',1)=owner_id::text)),add constraint itext_group_cover_owned check(cover_url is null or (cover_url like 'itext-media:%' and split_part(substr(cover_url,13),'/',1)=owner_id::text));
alter table public.itext_pages add constraint itext_page_avatar_owned check(avatar_url not like 'itext-media:%' or split_part(substr(avatar_url,13),'/',1)=owner_id::text),add constraint itext_page_cover_owned check(cover_url is null or (cover_url like 'itext-media:%' and split_part(substr(cover_url,13),'/',1)=owner_id::text)),add constraint itext_page_category_length check(length(trim(category)) between 1 and 60);
grant update(name,description,avatar_url,cover_url,category) on public.itext_groups,public.itext_pages to authenticated;
create policy "edit own group details" on public.itext_groups for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "edit own page details" on public.itext_pages for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create function itext_private.create_space_group(group_name text,group_description text,group_visibility text,group_join_policy text,group_avatar text,group_cover text,group_category text) returns uuid language plpgsql security definer set search_path='' as $$
declare gid uuid;
begin
 if (select auth.uid()) is null then raise exception 'Entre na sua conta.';end if;
 gid:=public.itext_create_group(group_name,group_description,group_visibility,group_join_policy);
 update public.itext_groups set avatar_url=group_avatar,cover_url=group_cover,category=coalesce(nullif(trim(group_category),''),'Não definido') where id=gid;
 return gid;
end;$$;
create function public.itext_create_space_group(group_name text,group_description text,group_visibility text,group_join_policy text,group_avatar text default null,group_cover text default null,group_category text default 'Não definido') returns uuid language sql security invoker set search_path='' as $$select itext_private.create_space_group(group_name,group_description,group_visibility,group_join_policy,group_avatar,group_cover,group_category);$$;
revoke all on function itext_private.create_space_group(text,text,text,text,text,text,text),public.itext_create_space_group(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function itext_private.create_space_group(text,text,text,text,text,text,text),public.itext_create_space_group(text,text,text,text,text,text,text) to authenticated;
-- Keep the existing private bucket and owner/access policies for downloadable attachments.
update storage.buckets set allowed_mime_types=array['image/*','audio/*','video/*','application/pdf','text/plain','text/csv','application/json','application/zip','application/x-zip-compressed','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet','application/vnd.oasis.opendocument.presentation','application/rtf','application/octet-stream'] where id='itext-media';
-- Preserve the function OID used by the storage RLS policy.
create or replace function itext_private.itext_media_readable(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(object_name,'/',1)=(select auth.uid())::text
 or exists(select 1 from public.chat_profiles where avatar_url='itext-media:'||object_name or cover_url='itext-media:'||object_name)
 or exists(select 1 from public.itext_posts where media @> jsonb_build_array(jsonb_build_object('storagePath',object_name)) and public.itext_read_post(id))
 or exists(select 1 from public.itext_posts where group_id is null and media @> jsonb_build_array(jsonb_build_object('storagePath',object_name,'type','image')))
 or exists(select 1 from public.itext_stories where media_path=object_name and (select auth.uid()) is not null and itext_private.story_readable(id))
 or ((select auth.uid()) is not null and exists(select 1 from public.itext_dating where discovery_enabled and 'itext-media:'||object_name=any(photos) and not itext_private.blocked_pair((select auth.uid()),user_id,true)))
 or exists(select 1 from public.itext_groups g where (g.avatar_url='itext-media:'||object_name or g.cover_url='itext-media:'||object_name) and public.itext_read_group(g.id))
 or exists(select 1 from public.itext_pages p where (p.avatar_url='itext-media:'||object_name or p.cover_url='itext-media:'||object_name) and not itext_private.blocked_pair((select auth.uid()),p.owner_id,true));
$$;

create table public.itext_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.chat_profiles(id) on delete cascade,actor_id uuid not null references public.chat_profiles(id) on delete cascade,
 kind text not null check(kind in('post_like','comment','reply','comment_like','follow','message','story_like','page_follow','group_request','group_accepted')),
 post_id uuid references public.itext_posts(id) on delete cascade,comment_id uuid references public.itext_comments(id) on delete cascade,message_id uuid references public.direct_messages(id) on delete cascade,story_id uuid references public.itext_stories(id) on delete cascade,group_id uuid references public.itext_groups(id) on delete cascade,page_id uuid references public.itext_pages(id) on delete cascade,
 created_at timestamptz not null default now(),read_at timestamptz,check(user_id<>actor_id)
);
create index itext_notifications_user_idx on public.itext_notifications(user_id,created_at desc,id);
create index itext_notifications_actor_idx on public.itext_notifications(actor_id);
create index itext_notifications_post_idx on public.itext_notifications(post_id);
create index itext_notifications_comment_idx on public.itext_notifications(comment_id);
create index itext_notifications_message_idx on public.itext_notifications(message_id);
create index itext_notifications_story_idx on public.itext_notifications(story_id);
create index itext_notifications_group_idx on public.itext_notifications(group_id);
create index itext_notifications_page_idx on public.itext_notifications(page_id);
alter table public.itext_notifications enable row level security;
revoke all on public.itext_notifications from public,anon,authenticated;
grant select on public.itext_notifications to authenticated;
create policy "own readable notifications" on public.itext_notifications for select to authenticated using(user_id=(select auth.uid()) and not itext_private.blocked_pair((select auth.uid()),actor_id,kind<>'message') and (post_id is null or public.itext_read_post(post_id)) and (comment_id is null or itext_private.comment_readable(comment_id)) and (message_id is null or exists(select 1 from public.direct_messages m where m.id=message_id and m.deleted_at is null)) and (group_id is null or public.itext_read_group(group_id)));
create table public.itext_activity(user_id uuid primary key references public.chat_profiles(id) on delete cascade,version bigint not null default 1);
alter table public.itext_activity enable row level security;
revoke all on public.itext_activity from public,anon,authenticated;
grant select on public.itext_activity to authenticated;
create policy "own activity signal" on public.itext_activity for select to authenticated using(user_id=(select auth.uid()));
create function itext_private.signal_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid:=case when tg_op='DELETE' then old.user_id else new.user_id end;
begin if not exists(select 1 from public.chat_profiles where id=target) then return null;end if;insert into public.itext_activity(user_id) values(case when tg_op='DELETE' then old.user_id else new.user_id end) on conflict(user_id) do update set version=itext_activity.version+1;return null;end;$$;
revoke all on function itext_private.signal_notification() from public,anon,authenticated;
create trigger itext_signal_notification after insert or update or delete on public.itext_notifications for each row execute function itext_private.signal_notification();
create function itext_private.mark_notifications(ids uuid[] default null) returns void language plpgsql security definer set search_path='' as $$begin if (select auth.uid()) is null then raise exception 'Entre na sua conta.';end if;update public.itext_notifications set read_at=clock_timestamp() where user_id=(select auth.uid()) and read_at is null and (ids is null or id=any(ids[1:100]));end;$$;
create function public.itext_mark_notifications(ids uuid[] default null) returns void language sql security invoker set search_path='' as $$select itext_private.mark_notifications(ids);$$;
revoke all on function itext_private.mark_notifications(uuid[]),public.itext_mark_notifications(uuid[]) from public,anon,authenticated;
grant execute on function itext_private.mark_notifications(uuid[]),public.itext_mark_notifications(uuid[]) to authenticated;
create function itext_private.enqueue_notification(target uuid,actor uuid,event text,pid uuid default null,cid uuid default null,mid uuid default null,sid uuid default null,gid uuid default null,pgid uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 if target is null or actor is null or target=actor or itext_private.blocked_pair(target,actor,event<>'message') then return;end if;
 insert into public.itext_notifications(user_id,actor_id,kind,post_id,comment_id,message_id,story_id,group_id,page_id) values(target,actor,event,pid,cid,mid,sid,gid,pgid);
end;$$;
revoke all on function itext_private.enqueue_notification(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
create function itext_private.notify_social_action() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;pid uuid;parent_author uuid;actor uuid;event text;
begin
 if tg_op='DELETE' then
  if tg_table_name='itext_likes' then delete from public.itext_notifications n where n.kind='post_like' and n.actor_id=old.user_id and n.post_id=old.post_id;
  elsif tg_table_name='itext_comment_likes' then delete from public.itext_notifications n where n.kind='comment_like' and n.actor_id=old.user_id and n.comment_id=old.comment_id;
  elsif tg_table_name='itext_follows' then delete from public.itext_notifications n where n.kind='follow' and n.actor_id=old.follower_id and n.user_id=old.following_id;
  elsif tg_table_name='itext_story_likes' then delete from public.itext_notifications n where n.kind='story_like' and n.actor_id=old.user_id and n.story_id=old.story_id;
  elsif tg_table_name='itext_page_follows' then delete from public.itext_notifications n where n.kind='page_follow' and n.actor_id=old.user_id and n.page_id=old.page_id;end if;return null;
 end if;
 if tg_table_name='itext_likes' then select author_id into target from public.itext_posts where id=new.post_id;perform itext_private.enqueue_notification(target,new.user_id,'post_like',new.post_id);
 elsif tg_table_name='itext_comments' then
  select author_id into target from public.itext_posts where id=new.post_id;
  if new.parent_id is not null then select author_id into parent_author from public.itext_comments where id=new.parent_id;perform itext_private.enqueue_notification(parent_author,new.author_id,'reply',new.post_id,new.id);end if;
  if target is distinct from parent_author then perform itext_private.enqueue_notification(target,new.author_id,'comment',new.post_id,new.id);end if;
 elsif tg_table_name='itext_comment_likes' then select author_id,post_id into target,pid from public.itext_comments where id=new.comment_id;perform itext_private.enqueue_notification(target,new.user_id,'comment_like',pid,new.comment_id);
 elsif tg_table_name='itext_follows' then perform itext_private.enqueue_notification(new.following_id,new.follower_id,'follow');
 elsif tg_table_name='itext_story_likes' then select author_id into target from public.itext_stories where id=new.story_id;perform itext_private.enqueue_notification(target,new.user_id,'story_like',sid=>new.story_id);
 elsif tg_table_name='itext_page_follows' then select owner_id into target from public.itext_pages where id=new.page_id;perform itext_private.enqueue_notification(target,new.user_id,'page_follow',pgid=>new.page_id);
 elsif tg_table_name='direct_messages' then
  if tg_op='INSERT' then perform itext_private.enqueue_notification(new.recipient_id,new.sender_id,'message',mid=>new.id);
  elsif new.deleted_at is not null then delete from public.itext_notifications where message_id=new.id;end if;
 elsif tg_table_name='itext_group_members' then
  select owner_id into target from public.itext_groups where id=new.group_id;
  if new.status='pending' and tg_op='INSERT' then perform itext_private.enqueue_notification(target,new.user_id,'group_request',gid=>new.group_id);
  elsif tg_op='UPDATE' and new.status='active' and old.status='pending' then perform itext_private.enqueue_notification(new.user_id,target,'group_accepted',gid=>new.group_id);end if;
 end if;return null;
end;$$;
revoke all on function itext_private.notify_social_action() from public,anon,authenticated;
create trigger itext_notify_post_like after insert or delete on public.itext_likes for each row execute function itext_private.notify_social_action();
create trigger itext_notify_comment after insert on public.itext_comments for each row execute function itext_private.notify_social_action();
create trigger itext_notify_comment_like after insert or delete on public.itext_comment_likes for each row execute function itext_private.notify_social_action();
create trigger itext_notify_follow after insert or delete on public.itext_follows for each row execute function itext_private.notify_social_action();
create trigger itext_notify_story_like after insert or delete on public.itext_story_likes for each row execute function itext_private.notify_social_action();
create trigger itext_notify_page_follow after insert or delete on public.itext_page_follows for each row execute function itext_private.notify_social_action();
create trigger itext_notify_message after insert or update on public.direct_messages for each row execute function itext_private.notify_social_action();
create trigger itext_notify_group_member after insert or update on public.itext_group_members for each row execute function itext_private.notify_social_action();
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.itext_activity;end if;end$$;
notify pgrst,'reload schema';
commit;
