-- Run after google-chat.sql. Adds the social app without changing existing messages.
begin;
alter table public.chat_profiles add column if not exists bio text not null default '';
alter table public.chat_profiles add column if not exists cover_url text;
alter table public.chat_profiles add column if not exists theme_color text not null default 'blue';
alter table public.chat_profiles add column if not exists interests text[] not null default '{}';
alter table public.chat_profiles add column if not exists settings jsonb not null default '{"feed":{"mode":"personalized"}}';
alter table public.chat_profiles add column if not exists onboarding_complete boolean not null default false;
grant update (bio, cover_url, theme_color, interests, settings, onboarding_complete) on public.chat_profiles to authenticated;

create or replace view public.itext_public_profiles with (security_barrier=true) as
select id,name,avatar_url,bio,cover_url,theme_color,interests,created_at from public.chat_profiles;
grant select on public.itext_public_profiles to anon,authenticated;

create table public.itext_groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.chat_profiles(id),
 name text not null check(char_length(trim(name)) between 1 and 80), description text not null default '',
 visibility text not null default 'public' check(visibility in ('public','private','unlisted')),
 join_policy text not null default 'open' check(join_policy in ('open','request')),
 created_at timestamptz not null default now()
);
create table public.itext_group_invites (
 group_id uuid primary key references public.itext_groups(id) on delete cascade,
 code text not null default replace(gen_random_uuid()::text,'-','')
);
create table public.itext_group_members (
 group_id uuid references public.itext_groups(id) on delete cascade, user_id uuid references public.chat_profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('owner','member')),
 status text not null default 'active' check(status in ('active','pending')),
 created_at timestamptz not null default now(), primary key(group_id,user_id)
);
create index itext_group_members_user_idx on public.itext_group_members(user_id,status);
create table public.itext_pages (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.chat_profiles(id),
 name text not null check(char_length(trim(name)) between 1 and 80),category text not null default 'Geral',description text not null default '',
 avatar_url text,created_at timestamptz not null default now()
);
create table public.itext_page_follows (
 page_id uuid references public.itext_pages(id) on delete cascade,user_id uuid references public.chat_profiles(id) on delete cascade,
 primary key(page_id,user_id)
);
create index itext_page_follows_user_idx on public.itext_page_follows(user_id);
create table public.itext_follows (
 follower_id uuid references public.chat_profiles(id) on delete cascade,following_id uuid references public.chat_profiles(id) on delete cascade,
 primary key(follower_id,following_id),check(follower_id<>following_id)
);
create table public.itext_posts (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.chat_profiles(id),
 text text not null default '' check(char_length(text)<=10000),code jsonb,media jsonb not null default '[]',
 group_id uuid references public.itext_groups(id) on delete cascade,page_id uuid references public.itext_pages(id) on delete cascade,
 categories text[] not null default '{}',tags text[] not null default '{}',created_at timestamptz not null default now(),
 check(group_id is null or page_id is null),check(jsonb_array_length(media)<=6),check(char_length(trim(text))>0 or coalesce(code->>'html','')<>'' or coalesce(code->>'css','')<>'' or coalesce(code->>'js','')<>'' or jsonb_array_length(media)>0)
);
create index itext_posts_created_idx on public.itext_posts(created_at desc);
create index itext_posts_author_idx on public.itext_posts(author_id,created_at desc);
create index itext_posts_group_idx on public.itext_posts(group_id);
create index itext_posts_page_idx on public.itext_posts(page_id);
create index itext_posts_media_idx on public.itext_posts using gin(media);
create table public.itext_likes (
 post_id uuid references public.itext_posts(id) on delete cascade,user_id uuid references public.chat_profiles(id) on delete cascade,
 primary key(post_id,user_id)
);
create table public.itext_comments (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.itext_posts(id) on delete cascade,
 author_id uuid not null references public.chat_profiles(id),text text not null check(char_length(trim(text)) between 1 and 2000),created_at timestamptz not null default now()
);
create index itext_comments_post_idx on public.itext_comments(post_id,created_at);

alter table public.chat_profiles add constraint itext_avatar_owned check(avatar_url not like 'itext-media:%' or split_part(substr(avatar_url,13),'/',1)=id::text);
alter table public.chat_profiles add constraint itext_cover_owned check(cover_url not like 'itext-media:%' or split_part(substr(cover_url,13),'/',1)=id::text);
create function public.itext_media_owned(input jsonb,uid uuid) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from jsonb_array_elements(input) item where item->>'storagePath' is null or split_part(item->>'storagePath','/',1)<>uid::text);
$$;
revoke all on function public.itext_media_owned(jsonb,uuid) from public;
grant execute on function public.itext_media_owned(jsonb,uuid) to authenticated;

create function public.itext_member(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_group_members where group_id=gid and user_id=(select auth.uid()) and status='active');
$$;
create function public.itext_owner(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_groups where id=gid and owner_id=(select auth.uid()));
$$;
create function public.itext_read_group(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_groups where id=gid and (visibility='public' or public.itext_member(id)));
$$;
create function public.itext_read_post(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_posts where id=pid and (group_id is null or public.itext_read_group(group_id)));
$$;
revoke all on function public.itext_member(uuid),public.itext_owner(uuid),public.itext_read_group(uuid),public.itext_read_post(uuid) from public;
grant execute on function public.itext_member(uuid),public.itext_owner(uuid),public.itext_read_group(uuid),public.itext_read_post(uuid) to anon,authenticated;

alter table public.itext_groups enable row level security;
alter table public.itext_group_invites enable row level security;
alter table public.itext_group_members enable row level security;
alter table public.itext_pages enable row level security;
alter table public.itext_page_follows enable row level security;
alter table public.itext_follows enable row level security;
alter table public.itext_posts enable row level security;
alter table public.itext_likes enable row level security;
alter table public.itext_comments enable row level security;
revoke all on public.itext_groups,public.itext_group_invites,public.itext_group_members,public.itext_pages,public.itext_page_follows,public.itext_follows,public.itext_posts,public.itext_likes,public.itext_comments from anon,authenticated;
grant select on public.itext_groups,public.itext_group_members,public.itext_pages,public.itext_page_follows,public.itext_follows,public.itext_posts,public.itext_likes,public.itext_comments to anon,authenticated;
grant select on public.itext_group_invites to authenticated;
grant insert on public.itext_pages,public.itext_page_follows,public.itext_follows,public.itext_posts,public.itext_likes,public.itext_comments to authenticated;
grant delete on public.itext_page_follows,public.itext_follows,public.itext_likes to authenticated;

create policy "visible groups" on public.itext_groups for select using(visibility='public' or public.itext_member(id));
create policy "owner reads invites" on public.itext_group_invites for select to authenticated using(public.itext_owner(group_id));
create policy "visible memberships" on public.itext_group_members for select using(user_id=(select auth.uid()) or public.itext_owner(group_id) or (status='active' and public.itext_read_group(group_id)));
create policy "public pages" on public.itext_pages for select using(true);
create policy "create own page" on public.itext_pages for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "page follows visible" on public.itext_page_follows for select using(true);
create policy "own page follow insert" on public.itext_page_follows for insert to authenticated with check(user_id=(select auth.uid()));
create policy "own page follow delete" on public.itext_page_follows for delete to authenticated using(user_id=(select auth.uid()));
create policy "follows visible" on public.itext_follows for select using(true);
create policy "own follow insert" on public.itext_follows for insert to authenticated with check(follower_id=(select auth.uid()));
create policy "own follow delete" on public.itext_follows for delete to authenticated using(follower_id=(select auth.uid()));
create policy "visible posts" on public.itext_posts for select using(group_id is null or public.itext_read_group(group_id));
create policy "create own authorized post" on public.itext_posts for insert to authenticated with check(
 author_id=(select auth.uid()) and public.itext_media_owned(media,(select auth.uid())) and (group_id is null or public.itext_member(group_id))
 and (page_id is null or exists(select 1 from public.itext_pages where id=page_id and owner_id=(select auth.uid())))
);
create policy "visible likes" on public.itext_likes for select using(public.itext_read_post(post_id));
create policy "own authorized like" on public.itext_likes for insert to authenticated with check(user_id=(select auth.uid()) and public.itext_read_post(post_id));
create policy "remove own like" on public.itext_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy "visible comments" on public.itext_comments for select using(public.itext_read_post(post_id));
create policy "own authorized comment" on public.itext_comments for insert to authenticated with check(author_id=(select auth.uid()) and public.itext_read_post(post_id));

create function public.itext_create_group(group_name text,group_description text,group_visibility text,group_join_policy text)
returns uuid language plpgsql security definer set search_path='' as $$
declare gid uuid;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 insert into public.itext_groups(owner_id,name,description,visibility,join_policy) values(auth.uid(),trim(group_name),left(group_description,240),group_visibility,group_join_policy) returning id into gid;
 insert into public.itext_group_members(group_id,user_id,role,status) values(gid,auth.uid(),'owner','active');
 insert into public.itext_group_invites(group_id) values(gid);
 return gid;
end;$$;
create function public.itext_group_by_invite(gid uuid,invite_code text default '') returns setof public.itext_groups
language sql stable security definer set search_path='' as $$
 select g.* from public.itext_groups g where g.id=gid and (public.itext_read_group(g.id) or (g.visibility='unlisted' and exists(select 1 from public.itext_group_invites i where i.group_id=g.id and i.code=invite_code)));
$$;
create function public.itext_join_group(gid uuid,invite_code text default '') returns text
language plpgsql security definer set search_path='' as $$
declare g public.itext_groups; next_status text; current_status text;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 select * into g from public.itext_groups where id=gid;
 if not found then raise exception 'Grupo não encontrado.'; end if;
 select status into current_status from public.itext_group_members where group_id=gid and user_id=auth.uid();
 if found then return current_status; end if;
 if g.visibility='private' or (g.visibility='unlisted' and not exists(select 1 from public.itext_group_invites where group_id=gid and code=invite_code)) then raise exception 'Convite inválido ou grupo privado.'; end if;
 next_status:=case when g.visibility='public' and g.join_policy='request' then 'pending' else 'active' end;
 insert into public.itext_group_members(group_id,user_id,status) values(gid,auth.uid(),next_status);
 return next_status;
end;$$;
create function public.itext_approve_member(gid uuid,member_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.itext_owner(gid) then raise exception 'Apenas o proprietário pode aprovar.'; end if;
 update public.itext_group_members set status='active' where group_id=gid and user_id=member_id and status='pending';
end;$$;
revoke all on function public.itext_create_group(text,text,text,text),public.itext_group_by_invite(uuid,text),public.itext_join_group(uuid,text),public.itext_approve_member(uuid,uuid) from public;
grant execute on function public.itext_create_group(text,text,text,text),public.itext_join_group(uuid,text),public.itext_approve_member(uuid,uuid) to authenticated;
grant execute on function public.itext_group_by_invite(uuid,text) to anon,authenticated;

create view public.itext_page_counts with(security_invoker=true) as select page_id,count(*)::integer as followers from public.itext_page_follows group by page_id;
create view public.itext_group_counts with(security_invoker=true) as select group_id,count(*)::integer as members from public.itext_group_members where status='active' group by group_id;
create view public.itext_post_counts with(security_invoker=true) as select p.id,
 (select count(*)::integer from public.itext_likes l where l.post_id=p.id) as likes,
 (select count(*)::integer from public.itext_comments c where c.post_id=p.id) as comments
 from public.itext_posts p;
grant select on public.itext_page_counts,public.itext_group_counts,public.itext_post_counts to anon,authenticated;

-- Dating is optional. Only the owner can read birth dates and coordinates.
create table public.itext_dating (
 user_id uuid primary key references public.chat_profiles(id) on delete cascade,
 birth_date date not null check(birth_date <= (current_date-interval '18 years')::date and birth_date >= (current_date-interval '110 years')::date),
 bio text not null default '',city text not null check(char_length(trim(city)) between 1 and 80),latitude numeric,longitude numeric,
 interests text[] not null default '{}',photos text[] not null default '{}',looking_for text not null default 'Conhecer pessoas',discovery_enabled boolean not null default true,
 check(latitude is null or latitude between -90 and 90),check(longitude is null or longitude between -180 and 180),
 check(latitude is null or latitude=round(latitude,1)),check(longitude is null or longitude=round(longitude,1))
);
create function public.itext_photos_owned(input text[],uid uuid) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from unnest(input) value where value like 'itext-media:%' and split_part(substr(value,13),'/',1)<>uid::text);
$$;
alter table public.itext_dating add constraint itext_photos_owned check(public.itext_photos_owned(photos,user_id));
create table public.itext_swipes (
 user_id uuid references public.chat_profiles(id) on delete cascade,candidate_id uuid references public.itext_dating(user_id) on delete cascade,
 action text not null check(action in ('like','pass')),primary key(user_id,candidate_id),check(user_id<>candidate_id)
);
create index itext_swipes_candidate_idx on public.itext_swipes(candidate_id,action);
alter table public.itext_dating enable row level security;
alter table public.itext_swipes enable row level security;
revoke all on public.itext_dating,public.itext_swipes from anon,authenticated;
grant select,insert,update on public.itext_dating to authenticated;
grant select,insert,update on public.itext_swipes to authenticated;
create policy "own dating profile" on public.itext_dating for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.itext_can_swipe(candidate uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.itext_dating own where own.user_id=auth.uid() and own.discovery_enabled)
 and exists(select 1 from public.itext_dating target where target.user_id=candidate and target.discovery_enabled);
$$;
revoke all on function public.itext_can_swipe(uuid) from public;
grant execute on function public.itext_can_swipe(uuid) to authenticated;
create policy "own swipes" on public.itext_swipes for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and candidate_id<>user_id and public.itext_can_swipe(candidate_id));
create function public.itext_dating_cards() returns table(
 id uuid,name text,avatar text,bio text,city text,age integer,interests text[],photos text[],looking_for text,distance_label text,matched boolean,swiped boolean
) language sql stable security definer set search_path='' as $$
 select d.user_id,p.name,p.avatar_url,d.bio,d.city,date_part('year',age(d.birth_date))::integer,d.interests,d.photos,d.looking_for,
 case when own.latitude is null or own.longitude is null or d.latitude is null or d.longitude is null then d.city
 when sqrt(power((own.latitude-d.latitude)*111,2)+power((own.longitude-d.longitude)*111*cos(radians(own.latitude::float)),2))<50 then 'a menos de 50 km (aproximado)' else 'a mais de 50 km (aproximado)' end,
 exists(select 1 from public.itext_swipes mine join public.itext_swipes theirs on theirs.user_id=mine.candidate_id and theirs.candidate_id=mine.user_id where mine.user_id=auth.uid() and mine.candidate_id=d.user_id and mine.action='like' and theirs.action='like'),
 exists(select 1 from public.itext_swipes s where s.user_id=auth.uid() and s.candidate_id=d.user_id)
 from public.itext_dating d join public.chat_profiles p on p.id=d.user_id join public.itext_dating own on own.user_id=auth.uid()
 where d.user_id<>auth.uid() and d.discovery_enabled order by cardinality(array(select unnest(d.interests) intersect select unnest(own.interests))) desc limit 80;
$$;
revoke all on function public.itext_dating_cards() from public;
grant execute on function public.itext_dating_cards() to authenticated;

-- Private files. Signed download URLs are created only for authorized readers.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('itext-media','itext-media',false,28000000,array['image/*','audio/*','video/*']) on conflict(id) do nothing;
create function public.itext_media_readable(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select split_part(object_name,'/',1)=(select auth.uid())::text
 or exists(select 1 from public.chat_profiles where avatar_url='itext-media:'||object_name or cover_url='itext-media:'||object_name)
 or exists(select 1 from public.itext_posts where media @> jsonb_build_array(jsonb_build_object('storagePath',object_name)) and (group_id is null or public.itext_read_group(group_id)))
 or ((select auth.uid()) is not null and exists(select 1 from public.itext_dating where discovery_enabled and 'itext-media:'||object_name=any(photos)));
$$;
revoke all on function public.itext_media_readable(text) from public;
grant execute on function public.itext_media_readable(text) to anon,authenticated;
create policy "itext upload own files" on storage.objects for insert to authenticated with check(bucket_id='itext-media' and split_part(name,'/',1)=(select auth.uid())::text);
create policy "itext read authorized files" on storage.objects for select to anon,authenticated using(bucket_id='itext-media' and public.itext_media_readable(name));
commit;
