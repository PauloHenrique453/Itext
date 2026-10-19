begin;
-- Presentation is a fixed vocabulary, never arbitrary CSS/HTML or media URLs.
alter table public.itext_stories add column presentation jsonb not null default '{}'::jsonb;
alter table public.itext_stories add constraint itext_story_presentation_check check(
 jsonb_typeof(presentation)='object'
 and presentation - array['size','align','position','color','fit','filter','muted']::text[]='{}'::jsonb
 and (not presentation ? 'size' or presentation->'size' in ('"small"','"normal"','"large"'))
 and (not presentation ? 'align' or presentation->'align' in ('"left"','"center"','"right"'))
 and (not presentation ? 'position' or presentation->'position' in ('"top"','"middle"','"bottom"'))
 and (not presentation ? 'color' or presentation->'color' in ('"auto"','"white"','"black"','"yellow"'))
 and (not presentation ? 'fit' or presentation->'fit' in ('"contain"','"cover"'))
 and (not presentation ? 'filter' or presentation->'filter' in ('"none"','"warm"','"mono"','"vivid"'))
 and (not presentation ? 'muted' or jsonb_typeof(presentation->'muted')='boolean')
);
grant insert(id,presentation) on public.itext_stories to authenticated;
-- Preserve the existing access predicate for expired stories referenced by messages.
create or replace function itext_private.story_message_previews(ids uuid[]) returns table(message_id uuid,story jsonb) language sql stable security definer set search_path='' as $$
 select m.id,jsonb_build_object('id',s.id,'author_id',s.author_id,'media_path',s.media_path,'media_type',s.media_type,'text_content',s.text_content,'background_color',s.background_color,'font_style',s.font_style,'caption',s.caption,'created_at',s.created_at,'expires_at',s.expires_at,'presentation',s.presentation)
 from public.direct_messages m join public.itext_stories s on s.id=m.story_id
 where m.id=any(ids[1:100]) and s.deleted_at is null and itext_private.message_context_readable(m.id) and not itext_private.blocked_pair((select auth.uid()),s.author_id,true);
$$;
revoke all on function itext_private.story_message_previews(uuid[]) from public,anon;
notify pgrst,'reload schema';
commit;
