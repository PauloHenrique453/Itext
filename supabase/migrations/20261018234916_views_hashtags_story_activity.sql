begin;
-- Actual unique accounts, never client-supplied counters or viewer identities.
create table itext_private.post_views(post_id uuid not null references public.itext_posts(id) on delete cascade,viewer_id uuid not null references public.chat_profiles(id) on delete cascade,viewed_at timestamptz not null default clock_timestamp(),primary key(post_id,viewer_id));
create index itext_post_views_viewer_idx on itext_private.post_views(viewer_id,post_id);
alter table itext_private.post_views enable row level security;
revoke all on itext_private.post_views from public,anon,authenticated;
create table itext_private.story_views(story_id uuid not null references public.itext_stories(id) on delete cascade,viewer_id uuid not null references public.chat_profiles(id) on delete cascade,first_seen_at timestamptz not null default clock_timestamp(),last_seen_at timestamptz not null default clock_timestamp(),primary key(story_id,viewer_id));
create index itext_story_views_latest_idx on itext_private.story_views(story_id,last_seen_at desc,viewer_id);
create index itext_story_views_viewer_idx on itext_private.story_views(viewer_id,story_id);
alter table itext_private.story_views enable row level security;
revoke all on itext_private.story_views from public,anon,authenticated;

create function itext_private.post_view_count(pid uuid) returns bigint language sql stable security definer set search_path='' as $$
 select case when public.itext_read_post(pid) then (select count(*) from itext_private.post_views v where v.post_id=pid) else 0 end;
$$;
create function itext_private.record_post_view(pid uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());author uuid;
begin
 if uid is null or not public.itext_read_post(pid) then raise exception 'Publicação indisponível.';end if;
 select author_id into author from public.itext_posts where id=pid;
 if author<>uid then insert into itext_private.post_views(post_id,viewer_id) values(pid,uid) on conflict do nothing;end if;
 return itext_private.post_view_count(pid);
end;$$;
create function public.itext_record_post_view(pid uuid) returns bigint language sql security invoker set search_path='' as $$select itext_private.record_post_view(pid);$$;
create view public.itext_post_view_counts with(security_invoker=true) as select p.id,itext_private.post_view_count(p.id) as views from public.itext_posts p;
revoke all on public.itext_post_view_counts from public,anon,authenticated;
grant select on public.itext_post_view_counts to anon,authenticated;

create function itext_private.record_story_view(sid uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());author uuid;
begin
 if uid is null or not itext_private.story_readable(sid) then raise exception 'Story indisponível.';end if;
 select author_id into author from public.itext_stories where id=sid;
 if author<>uid then insert into itext_private.story_views(story_id,viewer_id) values(sid,uid) on conflict(story_id,viewer_id) do update set last_seen_at=clock_timestamp();end if;
end;$$;
create function public.itext_record_story_view(sid uuid) returns void language sql security invoker set search_path='' as $$select itext_private.record_story_view(sid);$$;

-- Hashtags are derived from the post text on the server, including existing real posts.
create function itext_private.hashtag_terms(body text) returns text[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(tag order by tag),'{}'::text[]) from (
 select distinct '#'||lower(normalize(m[2],NFC)) as tag from regexp_matches(normalize(coalesce(body,''),NFC),'(^|[^[:alnum:]_/#?&=])#([[:alnum:]_]{1,64})(?![[:alnum:]_])','g') m order by tag limit 30) t;
$$;
create function itext_private.derive_hashtags() returns trigger language plpgsql set search_path='' as $$begin new.tags=itext_private.hashtag_terms(new.text);return new;end;$$;
create trigger itext_derive_hashtags before insert or update of text,tags on public.itext_posts for each row execute function itext_private.derive_hashtags();
alter table public.itext_posts disable trigger itext_stamp_post_edit;
update public.itext_posts set tags=itext_private.hashtag_terms(text) where tags is distinct from itext_private.hashtag_terms(text);
alter table public.itext_posts enable trigger itext_stamp_post_edit;
create index if not exists itext_posts_hashtags_gin on public.itext_posts using gin(tags);
-- Invoker queries retain post RLS. Private-group tags never participate in trends.
create function public.itext_hashtag_trends() returns table(tag text,uses bigint,authors bigint,is_trending boolean,score double precision) language sql stable security invoker set search_path='' as $$
 with per_author as (
  select t.tag,p.author_id,count(*) as uses,max(p.created_at) as last_used from public.itext_posts p cross join lateral unnest(p.tags) t(tag)
  where p.group_id is null and p.created_at>=now()-interval '24 hours' and p.created_at<=now() group by t.tag,p.author_id
 ), totals as (
  select a.tag,sum(a.uses)::bigint as uses,count(*) as authors,(sum(least(a.uses,3))+count(*)*2+sum(exp(-greatest(0,extract(epoch from now()-a.last_used))/21600)))::double precision as score from per_author a group by a.tag
 ), ranked as(select t.*,row_number() over(order by t.score desc,t.uses desc,t.tag) as place from totals t)
 select r.tag,r.uses,r.authors,(r.place<=10 and r.uses>=3 and r.authors>=2),r.score from ranked r order by r.place limit 20;
$$;

-- Preview access follows message ownership, clearing, hiding, deletion and full blocks.
-- Stories are immutable; past replies can reference an expired story, but never a deleted one.
create function itext_private.message_context_readable(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.direct_messages m where m.id=mid and m.deleted_at is null and (
 ((m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid()))
 and not itext_private.blocked_pair(m.sender_id,m.recipient_id,true)
 and m.created_at>coalesce((select c.cleared_at from public.itext_conversation_settings c where c.user_id=(select auth.uid()) and c.partner_id=case when m.sender_id=(select auth.uid()) then m.recipient_id else m.sender_id end),'-infinity'::timestamptz)
 and not exists(select 1 from public.itext_message_hides h where h.user_id=(select auth.uid()) and h.message_id=m.id))
 or ((select public.itext_is_creator()) and m.sender_id<>(select auth.uid()) and m.recipient_id<>(select auth.uid()))
 ));
$$;
create function itext_private.story_message_previews(ids uuid[]) returns table(message_id uuid,story jsonb) language sql stable security definer set search_path='' as $$
 select m.id,jsonb_build_object('id',s.id,'author_id',s.author_id,'media_path',s.media_path,'media_type',s.media_type,'text_content',s.text_content,'background_color',s.background_color,'font_style',s.font_style,'caption',s.caption,'created_at',s.created_at,'expires_at',s.expires_at)
 from public.direct_messages m join public.itext_stories s on s.id=m.story_id
 where m.id=any(ids[1:100]) and s.deleted_at is null and itext_private.message_context_readable(m.id) and not itext_private.blocked_pair((select auth.uid()),s.author_id,true);
$$;
create function public.itext_story_message_previews(ids uuid[]) returns table(message_id uuid,story jsonb) language sql stable security invoker set search_path='' as $$select * from itext_private.story_message_previews(ids);$$;
create function itext_private.story_reply_media_readable(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.itext_stories s join public.direct_messages m on m.story_id=s.id where s.media_path=object_name and s.deleted_at is null and not itext_private.blocked_pair((select auth.uid()),s.author_id,true) and itext_private.message_context_readable(m.id));
$$;
create or replace function itext_private.itext_media_readable(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(object_name,'/',1)=(select auth.uid())::text
 or exists(select 1 from public.chat_profiles where avatar_url='itext-media:'||object_name or cover_url='itext-media:'||object_name)
 or exists(select 1 from public.itext_posts where media @> jsonb_build_array(jsonb_build_object('storagePath',object_name)) and public.itext_read_post(id))
 or exists(select 1 from public.itext_posts where group_id is null and media @> jsonb_build_array(jsonb_build_object('storagePath',object_name,'type','image')))
 or exists(select 1 from public.itext_stories where media_path=object_name and (select auth.uid()) is not null and itext_private.story_readable(id))
 or ((select auth.uid()) is not null and exists(select 1 from public.itext_dating where discovery_enabled and 'itext-media:'||object_name=any(photos) and not itext_private.blocked_pair((select auth.uid()),user_id,true)))
 or exists(select 1 from public.itext_groups g where (g.avatar_url='itext-media:'||object_name or g.cover_url='itext-media:'||object_name) and public.itext_read_group(g.id))
 or exists(select 1 from public.itext_pages p where (p.avatar_url='itext-media:'||object_name or p.cover_url='itext-media:'||object_name) and not itext_private.blocked_pair((select auth.uid()),p.owner_id,true))
 or itext_private.story_reply_media_readable(object_name);
$$;

create function itext_private.story_audience(sid uuid,p_filter text default 'all',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.itext_stories s where s.id=sid and s.author_id=(select auth.uid()) and s.deleted_at is null) then raise exception 'Somente o dono pode ver a atividade do story.';end if;
 if p_filter not in('all','views','likes','replies') or p_offset<0 or p_offset>100000 then raise exception 'Filtro inválido.';end if;
 with replies as(select m.sender_id,count(*) as replies,max(m.created_at) as replied_at,(array_agg(m.id order by m.created_at desc,m.id desc))[1] as message_id from public.direct_messages m where m.story_id=sid and itext_private.message_context_readable(m.id) group by m.sender_id),
 people as(select v.viewer_id as id from itext_private.story_views v where v.story_id=sid union select l.user_id from public.itext_story_likes l where l.story_id=sid union select r.sender_id from replies r),
 activity as(select p.id,p.name,p.avatar_url,v.last_seen_at,(l.user_id is not null) as liked,coalesce(r.replies,0) as replies,r.replied_at,r.message_id from people a join public.chat_profiles p on p.id=a.id left join itext_private.story_views v on v.story_id=sid and v.viewer_id=a.id left join public.itext_story_likes l on l.story_id=sid and l.user_id=a.id left join replies r on r.sender_id=a.id),
 filtered as(select * from activity a where p_filter='all' or (p_filter='views' and a.last_seen_at is not null) or (p_filter='likes' and a.liked) or (p_filter='replies' and a.replies>0)),
 page as(select * from filtered a order by greatest(a.last_seen_at,a.replied_at) desc nulls last,a.id limit 50 offset p_offset)
 select jsonb_build_object('views',(select count(*) from itext_private.story_views where story_id=sid),'likes',(select count(*) from public.itext_story_likes where story_id=sid),'replies',coalesce((select sum(replies) from replies),0),'latest',(select jsonb_build_object('id',a.id,'name',a.name,'avatar_url',a.avatar_url) from activity a where a.last_seen_at is not null order by a.last_seen_at desc,a.id limit 1),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'has_more',(select count(*) from filtered)>p_offset+50,'next_offset',p_offset+50) into result;
 return result;
end;$$;
create function public.itext_story_audience(sid uuid,p_filter text default 'all',p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select itext_private.story_audience(sid,p_filter,p_offset);$$;

revoke all on function itext_private.post_view_count(uuid),itext_private.record_post_view(uuid),public.itext_record_post_view(uuid),itext_private.record_story_view(uuid),public.itext_record_story_view(uuid),itext_private.hashtag_terms(text),itext_private.derive_hashtags(),public.itext_hashtag_trends(),itext_private.message_context_readable(uuid),itext_private.story_message_previews(uuid[]),public.itext_story_message_previews(uuid[]),itext_private.story_reply_media_readable(text),itext_private.story_audience(uuid,text,integer),public.itext_story_audience(uuid,text,integer) from public,anon,authenticated;
grant execute on function itext_private.post_view_count(uuid),itext_private.hashtag_terms(text),public.itext_hashtag_trends() to anon,authenticated;
grant execute on function itext_private.record_post_view(uuid),public.itext_record_post_view(uuid),itext_private.record_story_view(uuid),public.itext_record_story_view(uuid),itext_private.message_context_readable(uuid),itext_private.story_message_previews(uuid[]),public.itext_story_message_previews(uuid[]),itext_private.story_audience(uuid,text,integer),public.itext_story_audience(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
