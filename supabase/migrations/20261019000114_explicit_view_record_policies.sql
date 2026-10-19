begin;
-- These internal records are accessed only by the checked RPC implementations.
-- Explicit deny policies complement the revoked table privileges and private schema.
create policy "view records are rpc only" on itext_private.post_views for all to anon,authenticated using(false) with check(false);
create policy "story records are rpc only" on itext_private.story_views for all to anon,authenticated using(false) with check(false);
commit;
