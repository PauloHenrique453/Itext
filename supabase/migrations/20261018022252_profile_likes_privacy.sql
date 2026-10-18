-- Private by default. Counts stay public; the identity behind a like follows this preference.
begin;
alter table public.chat_profiles add column likes_public boolean not null default false;
grant update(likes_public) on public.chat_profiles to authenticated;

create function itext_private.likes_visible(profile_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select p.likes_public or p.id=(select auth.uid()) from public.chat_profiles p where p.id=profile_id),false);
$$;
revoke all on function itext_private.likes_visible(uuid) from public,anon,authenticated;
grant execute on function itext_private.likes_visible(uuid) to anon,authenticated;
create function public.itext_likes_visible(profile_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$select itext_private.likes_visible(profile_id);$$;
revoke all on function public.itext_likes_visible(uuid) from public,anon,authenticated;
grant execute on function public.itext_likes_visible(uuid) to authenticated;

drop policy "visible likes" on public.itext_likes;
create policy "visible likes" on public.itext_likes for select to anon,authenticated
 using(public.itext_read_post(post_id) and itext_private.likes_visible(user_id));

-- Only an aggregate crosses like-identity RLS; it checks the actual post's visibility first.
create function itext_private.like_count(post_id uuid) returns integer
language sql stable security definer set search_path='' as $$
 select case when public.itext_read_post(post_id) then (select count(*)::integer from public.itext_likes l where l.post_id=like_count.post_id) else 0 end;
$$;
revoke all on function itext_private.like_count(uuid) from public,anon,authenticated;
grant execute on function itext_private.like_count(uuid) to anon,authenticated;
create or replace view public.itext_post_counts with(security_invoker=true) as
 select p.id,itext_private.like_count(p.id) as likes,
 (select count(*)::integer from public.itext_comments c where c.post_id=p.id) as comments
 from public.itext_posts p;

create function public.itext_liked_posts(profile_id uuid,after_id uuid default null)
returns setof public.itext_posts language sql stable security invoker set search_path='' as $$
 select p.* from public.itext_likes l join public.itext_posts p on p.id=l.post_id
 where (select auth.uid()) is not null and l.user_id=profile_id
 and (after_id is null or l.post_id>after_id)
 order by l.post_id limit 40;
$$;
revoke all on function public.itext_liked_posts(uuid,uuid) from public,anon,authenticated;
grant execute on function public.itext_liked_posts(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
