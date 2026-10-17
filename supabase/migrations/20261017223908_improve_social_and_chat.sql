-- Apply after the previous Itext migrations. No demonstration data is inserted.
begin;
create view public.itext_profile_counts with(security_invoker=true) as
 select p.id,
 (select count(*)::integer from public.itext_follows f where f.following_id=p.id) as followers,
 (select count(*)::integer from public.itext_follows f where f.follower_id=p.id) as following
 from public.itext_public_profiles p;
revoke all on public.itext_profile_counts from public,anon,authenticated;
grant select on public.itext_profile_counts to anon,authenticated;

create function public.itext_people(search_query text default '',after_id uuid default null,relation text default 'all')
returns table(profile jsonb,followers integer,following integer,followed boolean,follows_you boolean)
language sql stable security invoker set search_path='' as $$
 select to_jsonb(p),c.followers,c.following,
 exists(select 1 from public.itext_follows f where f.follower_id=(select auth.uid()) and f.following_id=p.id),
 exists(select 1 from public.itext_follows f where f.following_id=(select auth.uid()) and f.follower_id=p.id)
 from public.itext_public_profiles p join public.itext_profile_counts c on c.id=p.id
 where (select auth.uid()) is not null and p.id<>(select auth.uid())
 and (after_id is null or p.id>after_id) and p.name ilike '%'||left(search_query,80)||'%'
 and (relation='all' or (relation='following' and exists(select 1 from public.itext_follows f where f.follower_id=(select auth.uid()) and f.following_id=p.id))
 or (relation='followers' and exists(select 1 from public.itext_follows f where f.following_id=(select auth.uid()) and f.follower_id=p.id)))
 order by p.id limit 40;
$$;
revoke all on function public.itext_people(text,uuid,text) from public,anon,authenticated;
grant execute on function public.itext_people(text,uuid,text) to authenticated;

create table public.itext_conversation_reads(
 user_id uuid not null references public.chat_profiles(id) on delete cascade,
 partner_id uuid not null references public.chat_profiles(id) on delete cascade,
 last_read_at timestamptz not null,
 last_read_id uuid not null,
 primary key(user_id,partner_id), check(user_id<>partner_id)
);
create index itext_conversation_reads_partner_idx on public.itext_conversation_reads(partner_id);
alter table public.itext_conversation_reads enable row level security;
revoke all on public.itext_conversation_reads from public,anon,authenticated;
grant select on public.itext_conversation_reads to authenticated;
create policy "participants see conversation receipts" on public.itext_conversation_reads for select to authenticated
 using(user_id=(select auth.uid()) or partner_id=(select auth.uid()));

create function itext_private.mark_message_read(message_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.direct_messages; reader uuid:=(select auth.uid());
begin
 if reader is null then raise exception 'Entre na sua conta.'; end if;
 select * into m from public.direct_messages where id=message_id and recipient_id=reader;
 if not found then raise exception 'Mensagem recebida não encontrada.'; end if;
 insert into public.itext_conversation_reads(user_id,partner_id,last_read_at,last_read_id)
 values(reader,m.sender_id,m.created_at,m.id)
 on conflict(user_id,partner_id) do update
 set last_read_at=excluded.last_read_at,last_read_id=excluded.last_read_id
 where (excluded.last_read_at,excluded.last_read_id)>(itext_conversation_reads.last_read_at,itext_conversation_reads.last_read_id);
end;$$;
revoke all on function itext_private.mark_message_read(uuid) from public,anon,authenticated;
grant execute on function itext_private.mark_message_read(uuid) to authenticated;
create function public.itext_mark_message_read(message_id uuid) returns void
language sql security invoker set search_path='' as $$select itext_private.mark_message_read(message_id);$$;
revoke all on function public.itext_mark_message_read(uuid) from public,anon,authenticated;
grant execute on function public.itext_mark_message_read(uuid) to authenticated;

create view public.itext_chat_inbox with(security_invoker=true) as
 select case when m.sender_id=(select auth.uid()) then m.recipient_id else m.sender_id end as partner_id,
 max(m.created_at) as last_message_at,
 count(*) filter(where m.recipient_id=(select auth.uid()) and (r.last_read_at is null or (m.created_at,m.id)>(r.last_read_at,r.last_read_id)))::integer as unread
 from public.direct_messages m left join public.itext_conversation_reads r
 on r.user_id=(select auth.uid()) and r.partner_id=m.sender_id
 where m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid())
 group by case when m.sender_id=(select auth.uid()) then m.recipient_id else m.sender_id end;
revoke all on public.itext_chat_inbox from public,anon,authenticated;
grant select on public.itext_chat_inbox to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.itext_conversation_reads;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
