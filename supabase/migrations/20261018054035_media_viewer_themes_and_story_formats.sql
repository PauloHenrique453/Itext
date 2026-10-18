begin;
-- Idempotent, caller-authorized like changes in one round trip. All existing RLS still applies.
create function public.itext_set_post_like(pid uuid,desired boolean) returns table(likes integer,liked boolean)
language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null or desired is null or not exists(select 1 from public.itext_posts p where p.id=pid) then raise exception 'Publicação indisponível.';end if;
 if desired then insert into public.itext_likes(post_id,user_id) values(pid,(select auth.uid())) on conflict do nothing;
 else delete from public.itext_likes l where l.post_id=pid and l.user_id=(select auth.uid());end if;
 return query select c.likes,desired from public.itext_post_counts c where c.id=pid;
end;$$;
revoke all on function public.itext_set_post_like(uuid,boolean) from public,anon,authenticated;
grant execute on function public.itext_set_post_like(uuid,boolean) to authenticated;

alter table public.chat_profiles add constraint itext_appearance_choice check(settings->>'appearance' is null or settings->>'appearance' in('common','white','graphite','black'));
update storage.buckets set file_size_limit=50000000 where id='itext-media';
alter table public.itext_stories drop constraint itext_stories_media_type_check;
alter table public.itext_stories alter column media_path drop not null;
alter table public.itext_stories add column text_content text not null default '' check(length(text_content)<=1000),add column background_color text not null default '#102a43' check(background_color~'^#[0-9a-fA-F]{6}$'),add column font_style text not null default 'classic' check(font_style in('classic','serif','rounded','mono'));
alter table public.itext_stories add constraint itext_story_media_kind check(media_type in('image','video','audio','text')),add constraint itext_story_content_format check((media_type='text' and media_path is null and length(trim(text_content))>0) or (media_type in('image','video','audio') and media_path is not null));
grant insert(text_content,background_color,font_style) on public.itext_stories to authenticated;
drop policy "publish own story" on public.itext_stories;
create policy "publish own story" on public.itext_stories for insert to authenticated with check(author_id=(select auth.uid()) and ((media_type='text' and media_path is null) or exists(select 1 from storage.objects o where o.bucket_id='itext-media' and o.name=media_path)));

-- The profile photo exception returns only photo metadata, never hidden captions or private-group files.
create function itext_private.photo_post(pid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'author_id',p.author_id,'name',a.name,'avatar_url',a.avatar_url,'created_at',p.created_at,
 'media',(select jsonb_agg(jsonb_build_object('type','image','url',item->>'url','storagePath',item->>'storagePath')) from jsonb_array_elements(p.media) item where item->>'type'='image'),
 'can_interact',public.itext_read_post(p.id),
 'likes',case when public.itext_read_post(p.id) then (select count(*) from public.itext_likes l where l.post_id=p.id) else 0 end,
 'comments',case when public.itext_read_post(p.id) then (select count(*) from public.itext_comments c where c.post_id=p.id) else 0 end,
 'liked',public.itext_read_post(p.id) and exists(select 1 from public.itext_likes l where l.post_id=p.id and l.user_id=(select auth.uid())))
 from public.itext_posts p join public.chat_profiles a on a.id=p.author_id
 where (select auth.uid()) is not null and p.id=pid and (p.group_id is null or public.itext_read_post(p.id))
 and exists(select 1 from jsonb_array_elements(p.media) item where item->>'type'='image');
$$;
create function public.itext_photo_post(pid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select itext_private.photo_post(pid);$$;
revoke all on function itext_private.photo_post(uuid),public.itext_photo_post(uuid) from public,anon,authenticated;
grant execute on function itext_private.photo_post(uuid),public.itext_photo_post(uuid) to authenticated;
create index itext_photo_feed_order on public.itext_posts(created_at desc,id desc) where group_id is null and media @> '[{"type":"image"}]'::jsonb;
notify pgrst,'reload schema';
commit;
