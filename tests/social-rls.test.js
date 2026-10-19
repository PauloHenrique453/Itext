import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const ONE='00000000-0000-0000-0000-000000000001', TWO='00000000-0000-0000-0000-000000000002', THREE='00000000-0000-0000-0000-000000000003'
async function setup() {
 const db=new PGlite()
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select,insert on storage.objects to anon,authenticated;
 alter default privileges in schema public grant execute on functions to anon,authenticated;`)
 await db.exec(readFileSync('supabase/google-chat.sql','utf8'))
 await db.exec(readFileSync('supabase/social.sql','utf8'))
 await db.exec(readFileSync('supabase/creator-privacy.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261017192931_restrict_itext_api_privileges.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261017223908_improve_social_and_chat.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261018022252_profile_likes_privacy.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261018040725_optional_chat_protection.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261018044842_stories_requests_and_message_actions.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261018051650_comments_notifications_presence_spaces.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261018054035_media_viewer_themes_and_story_formats.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261018234916_views_hashtags_story_activity.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261019000114_explicit_view_record_policies.sql','utf8'))
 await db.query('insert into auth.users(id) values($1),($2),($3)',[ONE,TWO,THREE])
 return db
 } catch(error) { await db.close(); throw new Error(error.message) }
}
async function as(db,id=null){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(id?'set role authenticated':'set role anon')}

test('social schema protects group posts, page ownership and member approvals',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const group=(await db.query("select public.itext_create_group('Grupo','','public','request') as id")).rows[0].id
  await as(db,TWO)
  assert.equal((await db.query("select public.itext_join_group($1,'') as status",[group])).rows[0].status,'pending')
  await assert.rejects(db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Não aprovado',$2)",[TWO,group]))
  await assert.rejects(db.query('select public.itext_approve_member($1,$2)',[group,TWO]))
  await as(db,ONE);await db.query('select public.itext_approve_member($1,$2)',[group,TWO])
  const page=(await db.query("insert into public.itext_pages(owner_id,name) values($1,'Página') returning id",[ONE])).rows[0].id
  await as(db,TWO)
  await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Aprovado',$2)",[TWO,group])
  await assert.rejects(db.query("insert into public.itext_posts(author_id,text,page_id) values($1,'Não sou dono',$2)",[TWO,page]))
  await as(db,ONE)
  const unlisted=(await db.query("select public.itext_create_group('Privado','','unlisted','open') as id")).rows[0].id
  const code=(await db.query('select code from public.itext_group_invites where group_id=$1',[unlisted])).rows[0].code
  await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Só membros',$2)",[ONE,unlisted])
  await as(db,THREE)
  assert.equal((await db.query('select * from public.itext_groups where id=$1',[unlisted])).rows.length,0)
  assert.equal((await db.query('select * from public.itext_posts where group_id=$1',[unlisted])).rows.length,0)
  assert.equal((await db.query('select * from public.itext_group_invites where group_id=$1',[unlisted])).rows.length,0)
  await assert.rejects(db.query("select public.itext_join_group($1,'errado')",[unlisted]))
  await db.query('select public.itext_join_group($1,$2)',[unlisted,code])
  assert.equal((await db.query('select * from public.itext_posts where group_id=$1',[unlisted])).rows.length,1)
 }finally{await db.close()}
})

test('free Supabase storage uses owner uploads and enforces private group access',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const group=(await db.query("select public.itext_create_group('Só meu','','private','open') as id")).rows[0].id
  const path=`${ONE}/imagem.png`
  await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[path])
  await db.query('insert into public.itext_posts(author_id,group_id,media) values($1,$2,$3)',[ONE,group,JSON.stringify([{storagePath:path,url:`itext-media:${path}`,type:'image'}])])
  await as(db,TWO)
  assert.equal((await db.query('select * from storage.objects')).rows.length,0)
  assert.equal((await db.query('select * from public.itext_profile_photos($1)',[ONE])).rows.length,0)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[TWO,ONE])
  assert.equal((await db.query('select * from public.itext_profile_photos($1)',[ONE])).rows.length,0)
  await assert.rejects(db.query('update public.chat_profiles set avatar_url=$1 where id=$2',[`itext-media:${path}`,TWO]))
  await assert.rejects(db.query('insert into public.itext_posts(author_id,media) values($1,$2)',[TWO,JSON.stringify([{storagePath:path,type:'image'}])]))
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[`${ONE}/spoof.png`]))
  await as(db,ONE)
  await db.query('update public.chat_profiles set avatar_url=$1 where id=$2',[`itext-media:${path}`,ONE])
  await as(db)
  assert.equal((await db.query('select * from storage.objects')).rows.length,1)
  const profiles=(await db.query('select * from public.itext_public_profiles')).rows
  assert.equal(profiles.length,3);assert.equal('settings' in profiles[0],false)
 }finally{await db.close()}
})

test('dating does not expose birth dates, coordinates or one-sided likes',async()=>{
 const db=await setup()
 try{
  await as(db,ONE);await db.query("insert into public.itext_dating(user_id,birth_date,city,latitude,longitude) values($1,'1990-01-01','Cidade',-23.5,-46.6)",[ONE])
  await as(db,TWO);await db.query("insert into public.itext_dating(user_id,birth_date,city) values($1,'1990-01-01','Cidade')",[TWO])
  assert.equal((await db.query('select * from public.itext_dating')).rows.length,1)
  const cards=(await db.query('select * from public.itext_dating_cards()')).rows
  assert.equal(cards.length,1);assert.equal('birth_date' in cards[0],false);assert.equal('latitude' in cards[0],false)
  await db.query("insert into public.itext_swipes(user_id,candidate_id,action) values($1,$2,'like')",[TWO,ONE])
  await as(db,ONE);assert.equal((await db.query('select * from public.itext_swipes')).rows.length,0)
  assert.equal((await db.query('select * from public.itext_dating_cards()')).rows[0].matched,false)
  await db.query("insert into public.itext_swipes(user_id,candidate_id,action) values($1,$2,'like')",[ONE,TWO])
  assert.equal((await db.query('select * from public.itext_dating_cards()')).rows[0].matched,true)
  await as(db,TWO);await db.query('update public.itext_dating set discovery_enabled=false where user_id=$1',[TWO])
  await as(db,ONE);assert.equal((await db.query('select * from public.itext_dating_cards()')).rows.length,0)
 }finally{await db.close()}
})

test('public post counts are derived from real interactions; authorship and profile ownership are enforced',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const post=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Texto real') returning id",[ONE])).rows[0].id
  await as(db,TWO)
  await db.query('insert into public.itext_likes(post_id,user_id) values($1,$2)',[post,TWO])
  await db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Comentário real')",[post,TWO])
  await assert.rejects(db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Falso remetente')",[post,ONE]))
  await assert.rejects(db.query("insert into public.itext_posts(author_id,text) values($1,'Falso autor')",[ONE]))
  await db.query("update public.chat_profiles set bio='Minha bio',interests=array['design'] where id=$1",[TWO])
  await db.query("update public.chat_profiles set bio='Não permitido' where id=$1",[ONE])
  await as(db)
  const count=(await db.query('select * from public.itext_post_counts where id=$1',[post])).rows[0]
  assert.equal(count.likes,1);assert.equal(count.comments,1)
  const person=(await db.query('select * from public.itext_public_profiles where id=$1',[ONE])).rows[0]
  assert.equal(person.bio,'')
  await assert.rejects(db.query("insert into public.itext_posts(author_id,text) values($1,'Anônimo')",[ONE]))
 }finally{await db.close()}
})


test('API wrappers preserve public access while full profiles, private vaults and privileged implementations stay restricted',async()=>{
 const db=await setup()
 try{
  await db.exec(`reset role`)
  assert.equal((await db.query("select count(*)::integer as total from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows[0].total,0)
  assert.equal((await db.query("select bool_and('security_invoker=true'=any(c.reloptions)) as safe from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'")).rows[0].safe,true)
  await as(db,ONE)
  await db.query(`update public.chat_profiles set settings='{"privacy":"private"}' where id=$1`,[ONE])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.chat_profiles')).rows.length,1)
  assert.equal((await db.query('select * from public.itext_public_profiles')).rows.length,3)
  await db.exec('reset role')
  await db.query('insert into public.itext_chat_privacy(owner_id) values($1)',[ONE])
  await as(db,ONE)
  await db.query('insert into public.itext_chat_keys(user_id,public_key,encrypted_private_key,fingerprint,notice_version) values($1,$2,$3,$4,$5)',[ONE,'-----BEGIN PGP PUBLIC KEY BLOCK-----'+ 'a'.repeat(150),'-----BEGIN PGP PRIVATE KEY BLOCK-----'+'b'.repeat(150),'a'.repeat(40),'creator-access-v1'])
  assert.equal((await db.query('select public.itext_is_creator() as allowed')).rows[0].allowed,true)
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_chat_keys')).rows.length,0)
  assert.equal((await db.query('select * from public.itext_chat_public_keys')).rows.length,1)
  assert.equal((await db.query('select public.itext_is_creator() as allowed')).rows[0].allowed,false)
  for(const id of [TWO,THREE]){
    await as(db,id)
    await db.query('update public.chat_profiles set chat_protection_enabled=true where id=$1',[id])
    await db.query('insert into public.itext_chat_keys(user_id,public_key,encrypted_private_key,fingerprint,notice_version) values($1,$2,$3,$4,$5)',[id,'-----BEGIN PGP PUBLIC KEY BLOCK-----'+'a'.repeat(150),'-----BEGIN PGP PRIVATE KEY BLOCK-----'+'b'.repeat(150),'a'.repeat(40),'creator-access-v1'])
  }
  await as(db,TWO)
  await db.query('insert into public.direct_messages(sender_id,recipient_id,owner_id,encryption_version,body) values($1,$2,$3,1,$4)',[TWO,THREE,ONE,'-----BEGIN PGP MESSAGE-----ciphertext'])
  await as(db,ONE)
  assert.equal((await db.query('select * from public.direct_messages')).rows.length,1)
  await as(db,THREE)
  assert.equal((await db.query('select * from public.direct_messages')).rows.length,1)
  await db.exec('reset role')
  const outsider='00000000-0000-0000-0000-000000000004'
  await db.query('insert into auth.users(id) values($1)',[outsider])
  await as(db,outsider)
  assert.equal((await db.query('select * from public.direct_messages')).rows.length,0)
  await as(db)
  assert.equal((await db.query('select public.itext_crypto_ready() as ready')).rows[0].ready,true)
  assert.equal((await db.query('select * from public.itext_public_profiles')).rows.length,4)
  for(const table of ['itext_chat_keys','chat_profiles','itext_chat_privacy','itext_chat_public_keys'])await assert.rejects(db.query(`select * from public.${table}`))
  await assert.rejects(db.query('select * from itext_private.chat_public_keys()'))
  for(const call of ["itext_create_group('x','','public','open')","itext_dating_cards()","itext_is_creator()"]){
    await assert.rejects(db.query(`select public.${call}`))
    await assert.rejects(db.query(`select itext_private.${call}`))
  }
 }finally{await db.close()}
})


test('follower counts reflect real follows and removals',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  await db.query('insert into public.itext_follows(follower_id,following_id) values($1,$2)',[ONE,TWO])
  await as(db,THREE)
  await db.query('insert into public.itext_follows(follower_id,following_id) values($1,$2)',[THREE,TWO])
  await as(db)
  assert.equal((await db.query('select followers from public.itext_profile_counts where id=$1',[TWO])).rows[0].followers,2)
  await as(db,ONE)
  await db.query('delete from public.itext_follows where follower_id=$1 and following_id=$2',[ONE,TWO])
  assert.equal((await db.query('select followers from public.itext_profile_counts where id=$1',[TWO])).rows[0].followers,1)
  const following=(await db.query("select * from public.itext_people('',null,'following')")).rows
  assert.equal(following.length,0)
  await as(db,THREE)
  assert.equal((await db.query("select * from public.itext_people('',null,'following')")).rows[0].profile.id,TWO)
  await as(db,TWO)
  const followers=(await db.query("select * from public.itext_people('',null,'followers')")).rows
  assert.equal(followers.length,1);assert.equal(followers[0].profile.id,THREE)
  assert.equal('settings' in followers[0].profile,false)
 }finally{await db.close()}
})

test('read receipts require the actual recipient and unread counts stay private even from creator review',async()=>{
 const db=await setup()
 try{
  await db.exec('reset role')
  await db.query('insert into public.itext_chat_privacy(owner_id) values($1)',[ONE])
  const mids=['00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012']
  for(const mid of mids)await db.query("insert into public.direct_messages(id,sender_id,recipient_id,owner_id,encryption_version,body,created_at) values($1,$2,$3,$4,1,'-----BEGIN PGP MESSAGE-----fixture','2026-10-17T12:00:00Z')",[mid,TWO,THREE,ONE])
  await as(db,ONE)
  assert.equal((await db.query('select * from public.direct_messages')).rows.length,3)
  assert.equal((await db.query('select * from public.itext_chat_inbox')).rows.length,0)
  await assert.rejects(db.query('select public.itext_mark_message_read($1)',[mids[1]]))
  await as(db,TWO)
  await assert.rejects(db.query('select public.itext_mark_message_read($1)',[mids[1]]))
  await as(db,THREE)
  assert.equal((await db.query('select unread from public.itext_chat_inbox')).rows[0].unread,3)
  await assert.rejects(db.query('insert into public.itext_conversation_reads(user_id,partner_id,last_read_at,last_read_id) values($1,$2,now(),$3)',[THREE,TWO,mids[2]]))
  await db.query('select public.itext_mark_message_read($1)',[mids[1]])
  assert.equal((await db.query('select unread from public.itext_chat_inbox')).rows[0].unread,1)
  await db.query('select public.itext_mark_message_read($1)',[mids[0]])
  assert.equal((await db.query('select last_read_id from public.itext_conversation_reads')).rows[0].last_read_id,mids[1])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_conversation_reads')).rows.length,1)
  await as(db,ONE)
  assert.equal((await db.query('select * from public.itext_conversation_reads')).rows.length,0)
  await as(db)
  for(const name of ['itext_chat_inbox','itext_conversation_reads'])await assert.rejects(db.query(`select * from public.${name}`))
  await assert.rejects(db.query('select public.itext_mark_message_read($1)',[mids[2]]))
 }finally{await db.close()}
})

test('hidden likes conceal identities and profile lists through the API while real post counts remain accurate',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const post=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Publicação') returning id",[ONE])).rows[0].id
  const gid=(await db.query("select public.itext_create_group('Privado','','unlisted','open') as id")).rows[0].id
  const secret=(await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Só grupo',$2) returning id",[ONE,gid])).rows[0].id
  for(const id of [post,secret])await db.query('insert into public.itext_likes(post_id,user_id) values($1,$2)',[id,ONE])
  assert.equal((await db.query('select * from public.itext_liked_posts($1)',[ONE])).rows.length,2)
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_likes where user_id=$1',[ONE])).rows.length,0)
  assert.equal((await db.query('select * from public.itext_liked_posts($1)',[ONE])).rows.length,0)
  assert.equal((await db.query('select public.itext_likes_visible($1) as visible',[ONE])).rows[0].visible,false)
  assert.equal((await db.query('select likes from public.itext_post_counts where id=$1',[post])).rows[0].likes,1)
  await db.query('update public.chat_profiles set likes_public=true where id=$1',[ONE])
  assert.equal((await db.query('select public.itext_likes_visible($1) as visible',[ONE])).rows[0].visible,false)
  await as(db,ONE)
  await db.query('update public.chat_profiles set likes_public=true where id=$1',[ONE])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_liked_posts($1)',[ONE])).rows.length,1)
  assert.equal((await db.query('select * from public.itext_likes where user_id=$1',[ONE])).rows.length,1)
  assert.equal((await db.query('select itext_private.like_count($1) as likes',[secret])).rows[0].likes,0)
  await as(db)
  assert.equal((await db.query('select likes from public.itext_post_counts where id=$1',[post])).rows[0].likes,1)
  await assert.rejects(db.query('select * from public.itext_liked_posts($1)',[ONE]))
  await as(db,ONE)
  await db.query('update public.chat_profiles set likes_public=false where id=$1',[ONE])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_likes where user_id=$1',[ONE])).rows.length,0)
  await db.query('insert into public.itext_likes(post_id,user_id) values($1,$2)',[post,TWO])
  assert.equal((await db.query('select * from public.itext_likes where user_id=$1',[TWO])).rows.length,1)
  await db.query('delete from public.itext_likes where post_id=$1 and user_id=$2',[post,TWO])
  assert.equal((await db.query('select likes from public.itext_post_counts where id=$1',[post])).rows[0].likes,1)
 }finally{await db.close()}
})


test('standard chats work without key setup; opt-in encryption requires both participants and never exposes another vault',async()=>{
 const db=await setup()
 try{
  await as(db,TWO)
  assert.equal((await db.query('select chat_protection_enabled from public.chat_profiles')).rows[0].chat_protection_enabled,false)
  const message=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,owner_id) values($1,$2,'Conversa padrão',0,null) returning id",[TWO,THREE])).rows[0].id
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version) values($1,$2,'Falso remetente',0)",[ONE,THREE]))
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version) values($1,$1,'Eu mesmo',0)",[TWO]))
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version) values($1,$2,$3,0)",[TWO,THREE,'a'.repeat(4001)]))
  await as(db,ONE)
  assert.equal((await db.query('select * from public.direct_messages where id=$1',[message])).rows.length,0)
  await as(db,THREE)
  assert.equal((await db.query('select body from public.direct_messages where id=$1',[message])).rows[0].body,'Conversa padrão')
  await db.exec('reset role')
  await db.query('insert into public.itext_chat_privacy(owner_id) values($1)',[ONE])
  for(const id of [ONE,TWO,THREE]){
   await as(db,id)
   await db.query('insert into public.itext_chat_keys(user_id,public_key,encrypted_private_key,fingerprint,notice_version) values($1,$2,$3,$4,$5)',[id,'-----BEGIN PGP PUBLIC KEY BLOCK-----'+'a'.repeat(150),'-----BEGIN PGP PRIVATE KEY BLOCK-----'+'b'.repeat(150),'a'.repeat(40),'creator-access-v1'])
  }
  await as(db,TWO)
  await db.query('update public.chat_profiles set chat_protection_enabled=true where id=$1',[TWO])
  await db.query('update public.chat_profiles set chat_protection_enabled=true where id=$1',[THREE])
  assert.equal((await db.query('select enabled from public.itext_chat_preferences where user_id=$1',[THREE])).rows[0].enabled,false)
  const insert=()=>db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,owner_id) values($1,$2,'-----BEGIN PGP MESSAGE-----fixture',1,$3)",[TWO,THREE,ONE])
  await assert.rejects(insert())
  await as(db,THREE)
  await db.query('update public.chat_profiles set chat_protection_enabled=true where id=$1',[THREE])
  await as(db,TWO);await insert()
  await as(db,THREE)
  await db.query('update public.chat_profiles set chat_protection_enabled=false where id=$1',[THREE])
  assert.equal((await db.query('select * from public.direct_messages where encryption_version=1')).rows.length,1)
  assert.equal((await db.query('select * from public.itext_chat_keys')).rows.length,1)
  await as(db,TWO);await assert.rejects(insert())
  await as(db,ONE)
  assert.equal((await db.query('select * from public.direct_messages')).rows.length,2)
  await as(db)
  await assert.rejects(db.query('select * from public.itext_chat_preferences'))
  await assert.rejects(db.query('select * from public.direct_messages'))
 }finally{await db.close()}
})

test('unknown messages are private requests until accepted or either direction follows; clearing is per user',async()=>{
 const db=await setup()
 try{
  await as(db,TWO)
  const mid=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Oi') returning id",[TWO,THREE])).rows[0].id
  assert.equal((await db.query('select unknown from public.itext_chat_inbox')).rows[0].unknown,false)
  await as(db,THREE)
  let inbox=(await db.query('select * from public.itext_chat_inbox')).rows[0]
  assert.equal(inbox.unknown,true);assert.equal(inbox.unread,1)
  await db.query("select public.itext_conversation_action($1,'accept')",[TWO])
  assert.equal((await db.query('select unknown from public.itext_chat_inbox')).rows[0].unknown,false)
  await assert.rejects(db.query('update public.itext_conversation_settings set cleared_at=now()'))
  await db.query("select public.itext_conversation_action($1,'clear')",[TWO])
  assert.equal((await db.query('select * from public.itext_chat_inbox')).rows.length,0)
  assert.equal((await db.query('select * from public.direct_messages where id=$1',[mid])).rows.length,0)
  await as(db,TWO)
  assert.equal((await db.query('select * from public.direct_messages where id=$1',[mid])).rows.length,1)
  await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Nova mensagem')",[TWO,THREE])
  await as(db,THREE)
  assert.equal((await db.query('select * from public.itext_chat_inbox')).rows[0].unread,1)
  assert.equal((await db.query('select * from public.direct_messages')).rows.length,1)
  await as(db,ONE)
  await db.query('insert into public.itext_follows(follower_id,following_id) values($1,$2)',[ONE,THREE])
  await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Seguidor')",[ONE,THREE])
  await as(db,THREE)
  assert.equal((await db.query('select unknown from public.itext_chat_inbox where partner_id=$1',[ONE])).rows[0].unknown,false)
 }finally{await db.close()}
})

test('chat-only blocks stop messaging but preserve posts; full blocks preserve only the profile photo gallery exception',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  await db.query("update public.chat_profiles set bio='Bio privada ao bloquear',avatar_url='itext-media:'||$1||'/avatar.png',likes_public=true where id=$1",[ONE])
  const media=[{type:'image',storagePath:ONE+'/photo.png',url:'itext-media:'+ONE+'/photo.png'},{type:'video',storagePath:ONE+'/video.mp4',url:'itext-media:'+ONE+'/video.mp4'}]
  const post=(await db.query("insert into public.itext_posts(author_id,text,media) values($1,'Legenda escondida',$2) returning id",[ONE,JSON.stringify(media)])).rows[0].id
  await as(db,TWO)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'chat')",[TWO,ONE])
  assert.equal((await db.query('select * from public.itext_posts where id=$1',[post])).rows.length,1)
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Não deve enviar')",[TWO,ONE]))
  await db.query("update public.itext_blocks set scope='all' where blocker_id=$1 and blocked_id=$2",[TWO,ONE])
  assert.equal((await db.query('select * from public.itext_posts where id=$1',[post])).rows.length,0)
  await assert.rejects(db.query('insert into public.itext_likes(post_id,user_id) values($1,$2)',[post,TWO]))
  await assert.rejects(db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Não permitido')",[post,TWO]))
  const person=(await db.query('select * from public.itext_public_profiles where id=$1',[ONE])).rows[0]
  assert.equal(person.bio,'');assert.ok(person.avatar_url)
  const photos=(await db.query('select * from public.itext_profile_photos($1)',[ONE])).rows
  assert.equal(photos.length,1);assert.equal(photos[0].media.length,1);assert.equal(photos[0].media[0].type,'image');assert.equal('text' in photos[0],false)
  assert.equal((await db.query('select public.itext_media_readable($1) as visible',[ONE+'/photo.png'])).rows[0].visible,true)
  assert.equal((await db.query('select public.itext_media_readable($1) as visible',[ONE+'/video.mp4'])).rows[0].visible,false)
  assert.equal((await db.query('select public.itext_media_readable($1) as visible',[ONE+'/avatar.png'])).rows[0].visible,true)
  await as(db,ONE)
  assert.equal((await db.query('select * from public.itext_blocks')).rows.length,0)
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Reverso bloqueado')",[ONE,TWO]))
  await as(db,TWO)
  await db.query('delete from public.itext_blocks where blocker_id=$1 and blocked_id=$2',[TWO,ONE])
  await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Desbloqueado')",[TWO,ONE])
 }finally{await db.close()}
})

test('post edits and deletion are author-only and cannot change ownership or use foreign uploads',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const id=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Antes') returning id",[ONE])).rows[0].id
  await as(db,TWO)
  await db.query("update public.itext_posts set text='Falso' where id=$1",[id])
  await db.query('delete from public.itext_posts where id=$1',[id])
  await as(db,ONE)
  assert.equal((await db.query('select text from public.itext_posts where id=$1',[id])).rows[0].text,'Antes')
  await assert.rejects(db.query('update public.itext_posts set author_id=$1 where id=$2',[TWO,id]))
  await assert.rejects(db.query('update public.itext_posts set media=$1 where id=$2',[JSON.stringify([{storagePath:TWO+'/stolen.png'}]),id]))
  await db.query("update public.itext_posts set text='Depois' where id=$1",[id])
  assert.ok((await db.query('select edited_at from public.itext_posts where id=$1',[id])).rows[0].edited_at)
  await db.query('delete from public.itext_posts where id=$1',[id])
  assert.equal((await db.query('select * from public.itext_posts where id=$1',[id])).rows.length,0)
 }finally{await db.close()}
})

test('message ownership, reply context, reactions and two deletion modes are enforced in Postgres',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const first=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Original') returning id",[ONE,TWO])).rows[0].id
  const outside=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Outra conversa') returning id",[ONE,THREE])).rows[0].id
  await as(db,TWO)
  await assert.rejects(db.query("select public.itext_message_action($1,'edit','Falso',0::smallint,null)",[first]))
  await assert.rejects(db.query("select public.itext_message_action($1,'delete')",[first]))
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,reply_to) values($1,$2,'Resposta falsa',$3)",[TWO,ONE,outside]))
  await db.query("insert into public.direct_messages(sender_id,recipient_id,body,reply_to) values($1,$2,'Resposta',$3)",[TWO,ONE,first])
  await db.query('insert into public.itext_message_reactions(message_id,user_id) values($1,$2)',[first,TWO])
  await assert.rejects(db.query('insert into public.itext_message_reactions(message_id,user_id) values($1,$2)',[outside,TWO]))
  await assert.rejects(db.query('update public.direct_messages set body=$1 where id=$2',['Sem RPC',first]))
  await as(db,ONE)
  await db.query("select public.itext_message_action($1,'edit','Editada',0::smallint,null)",[first])
  assert.equal((await db.query('select body from public.direct_messages where id=$1',[first])).rows[0].body,'Editada')
  await as(db,TWO)
  await db.query("select public.itext_message_action($1,'hide')",[first])
  assert.equal((await db.query('select * from public.direct_messages where id=$1',[first])).rows.length,0)
  await as(db,ONE)
  assert.equal((await db.query('select * from public.direct_messages where id=$1',[first])).rows.length,1)
  await db.query("select public.itext_message_action($1,'delete')",[first])
  const deleted=(await db.query('select * from public.direct_messages where id=$1',[first])).rows[0]
  assert.ok(deleted.deleted_at);assert.equal(deleted.body,'Mensagem apagada')
  assert.equal((await db.query('select * from public.itext_message_reactions where message_id=$1',[first])).rows.length,0)
  assert.ok((await db.query('select reaction_updated_at from public.direct_messages where id=$1',[first])).rows[0].reaction_updated_at)
  await assert.rejects(db.query('update public.direct_messages set reaction_updated_at=now() where id=$1',[first]))
  await as(db,THREE)
  await assert.rejects(db.query("select public.itext_message_action($1,'hide')",[first]))
 }finally{await db.close()}
})

test('stories require own uploaded media, expire on the server and replies go only to the actual story owner',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const path=ONE+'/story.png'
  await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[path])
  const story=(await db.query("insert into public.itext_stories(author_id,media_path,media_type) values($1,$2,'image') returning id",[ONE,path])).rows[0].id
  await assert.rejects(db.query("insert into public.itext_stories(author_id,media_path,media_type) values($1,$2,'image')",[ONE,THREE+'/foreign.png']))
  await assert.rejects(db.query("insert into public.itext_stories(author_id,media_path,media_type,expires_at) values($1,$2,'image',now()+interval '50 hours')",[ONE,path]))
  await as(db,TWO)
  await db.query('insert into public.itext_story_likes(story_id,user_id) values($1,$2)',[story,TWO])
  await db.query("insert into public.direct_messages(sender_id,recipient_id,body,story_id) values($1,$2,'Comentário privado',$3)",[TWO,ONE,story])
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,story_id) values($1,$2,'Dono falso',$3)",[TWO,THREE,story]))
  await as(db,THREE)
  assert.equal((await db.query('select likes from public.itext_story_counts where id=$1',[story])).rows[0].likes,1)
  assert.equal((await db.query('select * from public.itext_story_likes')).rows.length,0)
  await as(db,ONE)
  assert.equal((await db.query('select story_id from public.direct_messages')).rows[0].story_id,story)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'chat')",[ONE,TWO])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_stories where id=$1',[story])).rows.length,1)
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,story_id) values($1,$2,'Bloqueado',$3)",[TWO,ONE,story]))
  await as(db,ONE)
  await db.query("update public.itext_blocks set scope='all' where blocker_id=$1 and blocked_id=$2",[ONE,TWO])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_stories')).rows.length,0)
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)")
  await db.query("update public.itext_stories set created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where id=$1",[story])
  await as(db,THREE)
  assert.equal((await db.query('select * from public.itext_stories')).rows.length,0)
  await assert.rejects(db.query("insert into public.direct_messages(sender_id,recipient_id,body,story_id) values($1,$2,'Expirado',$3)",[THREE,ONE,story]))
  await assert.rejects(db.query('select public.itext_delete_story($1)',[story]))
  await as(db,ONE)
  await db.query('select public.itext_delete_story($1)',[story])
 }finally{await db.close()}
})


test('new message and story API tables deny anonymous reads and all metadata-only mutations are constrained',async()=>{
 const db=await setup()
 try{
  await as(db)
  for(const table of ['itext_blocks','itext_stories','itext_story_likes','itext_story_counts','itext_message_hides','itext_message_reactions','itext_conversation_settings']){
   await assert.rejects(db.query(`select * from public.${table} limit 0`))
  }
  await as(db,TWO)
  for(const rpc of ["select public.itext_message_action(null,'delete')","select public.itext_conversation_action(null,'accept')",'select public.itext_delete_story(null)'])await assert.rejects(db.query(rpc))
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'chat')",[TWO,ONE])
  await db.query("update public.itext_blocks set scope='all' where blocker_id=$1 and blocked_id=$2",[TWO,ONE])
  await assert.rejects(db.query('update public.itext_blocks set blocker_id=$1',[THREE]))
  await assert.rejects(db.query('update public.itext_blocks set created_at=now()'))
  await assert.rejects(db.query('insert into public.itext_conversation_settings(user_id,partner_id,accepted) values($1,$2,true)',[TWO,ONE]))
 }finally{await db.close()}
})

test('comment replies and likes enforce parent post, blocked authors and private group permissions',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const post=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Post') returning id",[ONE])).rows[0].id
  const other=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Outro') returning id",[ONE])).rows[0].id
  const parent=(await db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Comentário') returning id",[post,ONE])).rows[0].id
  await as(db,TWO)
  const reply=(await db.query("insert into public.itext_comments(post_id,author_id,text,parent_id) values($1,$2,'Resposta',$3) returning id",[post,TWO,parent])).rows[0].id
  await assert.rejects(db.query("insert into public.itext_comments(post_id,author_id,text,parent_id) values($1,$2,'Post errado',$3)",[other,TWO,parent]))
  await db.query('insert into public.itext_comment_likes(comment_id,user_id) values($1,$2)',[parent,TWO])
  await assert.rejects(db.query('insert into public.itext_comment_likes(comment_id,user_id) values($1,$2)',[reply,ONE]))
  await as(db,THREE)
  assert.equal((await db.query('select likes from public.itext_comment_counts where id=$1',[parent])).rows[0].likes,1)
  assert.equal((await db.query('select * from public.itext_comment_likes')).rows.length,0)
  await as(db,ONE)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO])
  assert.equal((await db.query('select * from public.itext_comments where id=$1',[reply])).rows.length,0)
  await as(db,TWO)
  await assert.rejects(db.query("insert into public.itext_comments(post_id,author_id,text,parent_id) values($1,$2,'Bloqueado',$3)",[post,TWO,parent]))
  await assert.rejects(db.query('insert into public.itext_comment_likes(comment_id,user_id) values($1,$2)',[parent,TWO]))
  await assert.rejects(db.query('update public.itext_comments set parent_id=null where id=$1',[reply]))
 }finally{await db.close()}
})

test('notifications are derived from real actions, private to their recipient and cannot be forged or marked for another user',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const post=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Post') returning id",[ONE])).rows[0].id
  await db.query('insert into public.itext_likes(post_id,user_id) values($1,$2)',[post,ONE])
  assert.equal((await db.query('select * from public.itext_notifications')).rows.length,0)
  await as(db,TWO)
  await db.query('insert into public.itext_likes(post_id,user_id) values($1,$2)',[post,TWO])
  const parent=(await db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Comentário') returning id",[post,TWO])).rows[0].id
  await as(db,THREE)
  await db.query("insert into public.itext_comments(post_id,author_id,text,parent_id) values($1,$2,'Resposta',$3)",[post,THREE,parent])
  await as(db,ONE)
  let own=(await db.query('select * from public.itext_notifications')).rows
  assert.equal(own.length,3);assert.ok(own.some(row=>row.kind==='post_like'));assert.equal(own.every(row=>row.user_id===ONE),true)
  const id=own[0].id
  await as(db,TWO)
  const theirs=(await db.query('select * from public.itext_notifications')).rows
  assert.equal(theirs.length,1);assert.equal(theirs[0].kind,'reply')
  await db.query('select public.itext_mark_notifications($1)',[[id]])
  await assert.rejects(db.query("insert into public.itext_notifications(user_id,actor_id,kind) values($1,$2,'follow')",[TWO,ONE]))
  await assert.rejects(db.query('update public.itext_notifications set read_at=now()'))
  await as(db,ONE)
  assert.equal((await db.query('select read_at from public.itext_notifications where id=$1',[id])).rows[0].read_at,null)
  await db.query('select public.itext_mark_notifications($1)',[[id]])
  assert.ok((await db.query('select read_at from public.itext_notifications where id=$1',[id])).rows[0].read_at)
  assert.ok((await db.query('select version from public.itext_activity')).rows[0].version>=4)
  await as(db,TWO)
  await db.query('delete from public.itext_likes where post_id=$1 and user_id=$2',[post,TWO])
  await as(db,ONE)
  assert.equal((await db.query("select * from public.itext_notifications where kind='post_like'")).rows.length,0)
  await as(db)
  for(const table of ['itext_presence','itext_notifications','itext_activity','itext_comment_likes'])await assert.rejects(db.query(`select * from public.${table} limit 0`))
 }finally{await db.close()}
})

test('presence uses independent server-timestamped leases, expires offline and hides status from blocked contacts',async()=>{
 const db=await setup(),first=crypto.randomUUID(),second=crypto.randomUUID()
 try{
  await as(db,ONE)
  await db.query('select public.itext_heartbeat($1,true)',[first]);await db.query('select public.itext_heartbeat($1,true)',[second])
  await assert.rejects(db.query('update public.itext_presence set last_seen=now()'))
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_presence')).rows.length,0)
  assert.equal((await db.query('select * from public.itext_online_status($1)',[[ONE]])).rows[0].online,true)
  await db.query('select public.itext_heartbeat($1,false)',[first])
  assert.equal((await db.query('select * from public.itext_online_status($1)',[[ONE]])).rows[0].online,true)
  await as(db,ONE);await db.query('select public.itext_heartbeat($1,false)',[first])
  await as(db,TWO)
  assert.equal((await db.query('select * from public.itext_online_status($1)',[[ONE]])).rows[0].online,true)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'chat')",[TWO,ONE])
  assert.equal((await db.query('select * from public.itext_online_status($1)',[[ONE]])).rows[0].online,false)
  await as(db,ONE);await db.query('select public.itext_heartbeat($1,false)',[second])
  await as(db,THREE)
  assert.equal((await db.query('select * from public.itext_online_status($1)',[[ONE]])).rows[0].online,false)
  await as(db,ONE);await db.query('select public.itext_heartbeat($1,true)',[first])
  await db.exec('reset role');await db.query("update public.itext_presence set last_seen=now()-interval '91 seconds' where user_id=$1",[ONE])
  await as(db,THREE)
  assert.equal((await db.query('select * from public.itext_online_status($1)',[[ONE]])).rows[0].online,false)
 }finally{await db.close()}
})

test('space photos, covers and custom categories are owner-controlled and group thumbnails stay private',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const photo='itext-media:'+ONE+'/group.png'
  const group=(await db.query("select public.itext_create_space_group('Espaço','','private','open',$1,$1,'Astronomia') as id",[photo])).rows[0].id
  assert.equal((await db.query('select category from public.itext_groups where id=$1',[group])).rows[0].category,'Astronomia')
  const page=(await db.query('insert into public.itext_pages(owner_id,name,avatar_url,cover_url) values($1,\'Página\',$2,$2) returning id',[ONE,photo])).rows[0].id
  await assert.rejects(db.query('update public.itext_groups set avatar_url=$1 where id=$2',['itext-media:'+TWO+'/stolen.png',group]))
  await db.query('update public.itext_groups set category=$1 where id=$2',['Não definido',group])
  await assert.rejects(db.query('update public.itext_groups set owner_id=$1 where id=$2',[TWO,group]))
  await as(db,TWO)
  await db.query('update public.itext_pages set name=$1 where id=$2',['Falso',page])
  await db.query('update public.itext_groups set name=$1 where id=$2',['Falso',group])
  await as(db,ONE)
  assert.equal((await db.query('select name from public.itext_pages where id=$1',[page])).rows[0].name,'Página')
  const onlyPrivate=ONE+'/private-thumb.png'
  await db.query('update public.itext_groups set cover_url=$1 where id=$2',['itext-media:'+onlyPrivate,group])
  await as(db,TWO)
  assert.equal((await db.query('select public.itext_media_readable($1) as allowed',[onlyPrivate])).rows[0].allowed,false)
  await assert.rejects(db.query("select public.itext_create_space_group('Inválido','','public','open',$1,null,'Arte')",['itext-media:'+ONE+'/stolen.png']))
 }finally{await db.close()}
})

test('private comments and message notifications remain hidden after blocks, conversation clearing and sender deletion',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const group=(await db.query("select public.itext_create_group('Privado','','private','open') as id")).rows[0].id
  const post=(await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Privado',$2) returning id",[ONE,group])).rows[0].id
  const comment=(await db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Privado') returning id",[post,ONE])).rows[0].id
  await as(db,TWO)
  await assert.rejects(db.query('insert into public.itext_comment_likes(comment_id,user_id) values($1,$2)',[comment,TWO]))
  await assert.rejects(db.query("insert into public.itext_comments(post_id,author_id,text,parent_id) values($1,$2,'Resposta indevida',$3)",[post,TWO,comment]))
  const message=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,'Mensagem') returning id",[TWO,THREE])).rows[0].id
  await as(db,THREE)
  let rows=(await db.query('select * from public.itext_notifications')).rows
  assert.equal(rows.length,1);assert.equal(rows[0].kind,'message');assert.equal(rows[0].message_id,message)
  await db.query("select public.itext_conversation_action($1,'clear')",[TWO])
  assert.equal((await db.query('select * from public.itext_notifications')).rows.length,0)
  await as(db,TWO)
  await db.query("select public.itext_message_action($1,'delete')",[message])
  await db.exec('reset role')
  assert.equal((await db.query('select * from public.itext_notifications where message_id=$1',[message])).rows.length,0)
  await as(db,TWO)
  await db.query('insert into public.itext_follows(follower_id,following_id) values($1,$2)',[TWO,ONE])
  await as(db,ONE)
  assert.equal((await db.query('select * from public.itext_notifications')).rows.length,1)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO])
  assert.equal((await db.query('select * from public.itext_notifications')).rows.length,0)
 }finally{await db.close()}
})

test('single-request post likes are idempotent, return real counts and retain block/private-group authorization',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const post=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Publicação') returning id",[ONE])).rows[0].id
  const group=(await db.query("select public.itext_create_group('Restrito','','private','request') as id")).rows[0].id
  const secret=(await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Grupo',$2) returning id",[ONE,group])).rows[0].id
  await as(db,TWO)
  for(let i=0;i<2;i++)assert.deepEqual((await db.query('select * from public.itext_set_post_like($1,true)',[post])).rows,[{likes:1,liked:true}])
  await assert.rejects(db.query('select * from public.itext_set_post_like($1,true)',[secret]))
  await as(db,ONE)
  assert.equal((await db.query("select count(*)::int as n from public.itext_notifications where kind='post_like' and post_id=$1",[post])).rows[0].n,1)
  await as(db,TWO)
  for(let i=0;i<2;i++)assert.deepEqual((await db.query('select * from public.itext_set_post_like($1,false)',[post])).rows,[{likes:0,liked:false}])
  await as(db,ONE);await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO])
  await as(db,TWO);await assert.rejects(db.query('select * from public.itext_set_post_like($1,true)',[post]))
  await as(db);await assert.rejects(db.query('select * from public.itext_set_post_like($1,true)',[post]))
 }finally{await db.close()}
})

test('photo viewer exposes only images on a full block and never exposes private-group captions or media',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1),('itext-media',$2)",[ONE+'/photo.jpg',ONE+'/movie.mp4'])
  const media=[{type:'image',url:'itext-media:'+ONE+'/photo.jpg',storagePath:ONE+'/photo.jpg'},{type:'video',url:'itext-media:'+ONE+'/movie.mp4',storagePath:ONE+'/movie.mp4'}]
  const post=(await db.query("insert into public.itext_posts(author_id,text,media) values($1,'Hidden caption',$2) returning id",[ONE,JSON.stringify(media)])).rows[0].id
  const group=(await db.query("select public.itext_create_group('Private','','private','request') as id")).rows[0].id
  const privatePost=(await db.query("insert into public.itext_posts(author_id,text,media,group_id) values($1,'Hidden group',$2,$3) returning id",[ONE,JSON.stringify(media),group])).rows[0].id
  await as(db,TWO)
  const open=(await db.query('select public.itext_photo_post($1) as photo',[post])).rows[0].photo
  assert.equal(open.can_interact,true);assert.equal(open.media.length,1);assert.equal(open.media[0].type,'image');assert.ok(!('text' in open))
  assert.equal((await db.query('select public.itext_photo_post($1) as photo',[privatePost])).rows[0].photo,null)
  await as(db,ONE);await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO])
  await as(db,TWO)
  const blocked=(await db.query('select public.itext_photo_post($1) as photo',[post])).rows[0].photo
  assert.equal(blocked.can_interact,false);assert.equal(blocked.likes,0);assert.equal(blocked.liked,false);assert.equal(blocked.media.length,1)
  assert.ok(!JSON.stringify(blocked).includes('Hidden caption'));assert.ok(!JSON.stringify(blocked).includes('movie.mp4'))
  await as(db);await assert.rejects(db.query('select public.itext_photo_post($1)',[post]))
 }finally{await db.close()}
})

test('text and audio stories validate content, ownership, fonts, colors and server expiration; appearance remains private',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const story=(await db.query("insert into public.itext_stories(author_id,media_type,text_content,background_color,font_style) values($1,'text','Um texto','#e5e7eb','serif') returning id",[ONE])).rows[0].id
  for(const [text,color,font] of [['','#102a43','classic'],['a','red','classic'],['a','#102a43','unknown']])await assert.rejects(db.query("insert into public.itext_stories(author_id,media_type,text_content,background_color,font_style) values($1,'text',$2,$3,$4)",[ONE,text,color,font]))
  const path=ONE+'/story.mp3';await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[path])
  await db.query("insert into public.itext_stories(author_id,media_path,media_type,text_content) values($1,$2,'audio','Áudio com texto')",[ONE,path])
  await assert.rejects(db.query("insert into public.itext_stories(author_id,media_path,media_type) values($1,$2,'audio')",[ONE,TWO+'/other.mp3']))
  for(const choice of ['common','white','graphite','black'])await db.query('update public.chat_profiles set settings=$1 where id=$2',[JSON.stringify({appearance:choice}),ONE])
  await assert.rejects(db.query('update public.chat_profiles set settings=$1 where id=$2',[JSON.stringify({appearance:'invalid'}),ONE]))
  await as(db,TWO)
  assert.equal((await db.query('select media_type,text_content from public.itext_stories where id=$1',[story])).rows[0].text_content,'Um texto')
  await db.query("insert into public.direct_messages(sender_id,recipient_id,body,story_id) values($1,$2,'Resposta de texto',$3)",[TWO,ONE,story])
  assert.ok(!('settings' in (await db.query('select * from public.itext_public_profiles where id=$1',[ONE])).rows[0]))
  await db.exec('reset role');await db.query("update public.itext_stories set created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where id=$1",[story])
  await as(db,TWO);assert.equal((await db.query('select id from public.itext_stories where id=$1',[story])).rows.length,0)
  await db.exec('reset role');assert.equal(Number((await db.query("select file_size_limit from storage.buckets where id='itext-media'")).rows[0].file_size_limit),50000000)
 }finally{await db.close()}
})

test('Ishort video discovery uses real post interactions and retains author ownership, group privacy and full blocks',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const path=ONE+'/short.mp4',media=JSON.stringify([{type:'video',short:true,duration:600,width:1080,height:1920,storagePath:path,url:'itext-media:'+path,size:1000}])
  await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[path])
  const post=(await db.query("insert into public.itext_posts(author_id,text,media) values($1,'Vídeo curto real',$2) returning id",[ONE,media])).rows[0].id
  const group=(await db.query("select public.itext_create_group('Privado','','private','request') as id")).rows[0].id
  await db.query('insert into public.itext_posts(author_id,text,group_id,media) values($1,\'Vídeo do grupo\',$2,$3)',[ONE,group,media])
  await as(db,TWO)
  const query="select id from public.itext_posts where group_id is null and media @> '[{\"type\":\"video\",\"short\":true}]'::jsonb"
  assert.deepEqual((await db.query(query)).rows.map(row=>row.id),[post])
  await assert.rejects(db.query("insert into public.itext_posts(author_id,media) values($1,$2)",[TWO,media]))
  await db.query('select * from public.itext_set_post_like($1,true)',[post])
  await db.query("insert into public.itext_comments(post_id,author_id,text) values($1,$2,'Comentário no vídeo')",[post,TWO])
  assert.deepEqual((await db.query('select likes,comments from public.itext_post_counts where id=$1',[post])).rows,[{likes:1,comments:1}])
  await as(db,ONE);await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO])
  await as(db,TWO);assert.equal((await db.query(query)).rows.length,0)
  await assert.rejects(db.query('select * from public.itext_set_post_like($1,true)',[post]))
 }finally{await db.close()}
})

test('post views count distinct authorized accounts, exclude the author and reject anonymous, blocked and private-group access',async()=>{
 const db=await setup()
 try{
  await as(db,ONE);const post=(await db.query("insert into public.itext_posts(author_id,text) values($1,'Real view test') returning id",[ONE])).rows[0].id
  assert.equal(Number((await db.query('select public.itext_record_post_view($1) as n',[post])).rows[0].n),0)
  await as(db,TWO);for(let i=0;i<3;i++)assert.equal(Number((await db.query('select public.itext_record_post_view($1) as n',[post])).rows[0].n),1)
  await assert.rejects(db.query('select * from itext_private.post_views'))
  await as(db,THREE);assert.equal(Number((await db.query('select public.itext_record_post_view($1) as n',[post])).rows[0].n),2)
  await as(db);assert.equal(Number((await db.query('select views from public.itext_post_view_counts where id=$1',[post])).rows[0].views),2);await assert.rejects(db.query('select public.itext_record_post_view($1)',[post]))
  await as(db,ONE);const group=(await db.query("select public.itext_create_group('Private view test','','private','open') as id")).rows[0].id
  const secret=(await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'Private',$2) returning id",[ONE,group])).rows[0].id
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO])
  await as(db,TWO);await assert.rejects(db.query('select public.itext_record_post_view($1)',[post]));assert.equal((await db.query('select * from public.itext_post_view_counts where id=$1',[post])).rows.length,0)
  await as(db,THREE);await assert.rejects(db.query('select public.itext_record_post_view($1)',[secret]))
 }finally{await db.close()}
})

test('server hashtags normalize accents/case, reject forged tags and URL fragments; trends use recent public posts and multiple authors',async()=>{
 const db=await setup()
 try{
  await as(db,ONE)
  const post=(await db.query("insert into public.itext_posts(author_id,text,tags) values($1,'#Café #café #azul https://example.test/#hidden',array['#forged']) returning id,tags",[ONE])).rows[0]
  assert.deepEqual(post.tags,['#azul','#café'])
  await db.query("insert into public.itext_posts(author_id,text) values($1,'#Café again')",[ONE])
  await as(db,TWO);await db.query("insert into public.itext_posts(author_id,text) values($1,'#café third')",[TWO])
  await as(db,ONE)
  const group=(await db.query("select public.itext_create_group('Hidden tags','','private','open') as id")).rows[0].id
  for(let i=0;i<4;i++)await db.query("insert into public.itext_posts(author_id,text,group_id) values($1,'#secret',$2)",[ONE,group])
  for(let i=0;i<8;i++)await db.query("insert into public.itext_posts(author_id,text) values($1,'#spam')",[ONE])
  let trends=(await db.query('select * from public.itext_hashtag_trends()')).rows
  assert.equal(trends.find(row=>row.tag==='#café').is_trending,true);assert.equal(trends.find(row=>row.tag==='#spam').is_trending,false);assert.ok(!trends.some(row=>row.tag==='#secret'||row.tag==='#forged'||row.tag==='#hidden'))
  await db.query("update public.itext_posts set text='Sem hashtag',tags=array['#forged'] where id=$1",[post.id]);assert.deepEqual((await db.query('select tags from public.itext_posts where id=$1',[post.id])).rows[0].tags,[])
  trends=(await db.query('select * from public.itext_hashtag_trends()')).rows;assert.equal(trends.find(row=>row.tag==='#café').is_trending,false)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO]);trends=(await db.query('select * from public.itext_hashtag_trends()')).rows;assert.equal(Number(trends.find(row=>row.tag==='#café').uses),1)
 }finally{await db.close()}
})

test('only the story owner sees its audience with actual likes/replies; story previews stay private after expiry and honor hiding and deletion',async()=>{
 const db=await setup()
 try{
  const path=`${ONE}/story-context.jpg`
  await as(db,ONE);await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[path])
  const story=(await db.query("insert into public.itext_stories(author_id,media_path,media_type) values($1,$2,'image') returning id",[ONE,path])).rows[0].id
  await db.query('select public.itext_record_story_view($1)',[story])
  await as(db,TWO);await db.query('select public.itext_record_story_view($1)',[story]);await db.query('select public.itext_record_story_view($1)',[story]);await db.query('insert into public.itext_story_likes(story_id,user_id) values($1,$2)',[story,TWO])
  const message=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,story_id) values($1,$2,'Reply',0,$3) returning id",[TWO,ONE,story])).rows[0].id
  await assert.rejects(db.query('select public.itext_story_audience($1)',[story]));await assert.rejects(db.query('select * from itext_private.story_views'))
  await as(db,ONE);let audience=(await db.query('select public.itext_story_audience($1) as a',[story])).rows[0].a
  assert.equal(audience.views,1);assert.equal(audience.likes,1);assert.equal(audience.replies,1);assert.equal(audience.latest.id,TWO);assert.equal(audience.rows[0].liked,true);assert.equal(audience.rows[0].replies,1)
  await as(db,THREE);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,0);await assert.rejects(db.query('select public.itext_story_audience($1)',[story]))
  await db.exec('reset role');await db.query("update public.itext_stories set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[story])
  await as(db,TWO);assert.equal((await db.query('select * from public.itext_stories where id=$1',[story])).rows.length,0)
  const preview=(await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows[0];assert.equal(preview.story.media_path,path);assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,1)
  await as(db,THREE);assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,0)
  await as(db,TWO);await db.query("select public.itext_message_action($1,'hide')",[message]);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,0);assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,0)
  await as(db,ONE);await db.query('select public.itext_delete_story($1)',[story]);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,0)
 }finally{await db.close()}
})

test('story reply previews revoke on conversation clear, message deletion and full blocks without exposing expired stories to outsiders',async()=>{
 const db=await setup()
 try{
  const path=`${ONE}/private-reply.png`;await as(db,ONE);await db.query("insert into storage.objects(bucket_id,name) values('itext-media',$1)",[path])
  const story=(await db.query("insert into public.itext_stories(author_id,media_path,media_type) values($1,$2,'image') returning id",[ONE,path])).rows[0].id
  await as(db,TWO);const message=(await db.query("insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,story_id) values($1,$2,'Preview',0,$3) returning id",[TWO,ONE,story])).rows[0].id
  await db.exec('reset role');await db.query("update public.itext_stories set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[story])
  await as(db,TWO);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,1)
  await db.query("select public.itext_conversation_action($1,'clear')",[ONE]);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,0);assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,0)
  await as(db,ONE);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,1)
  await db.query("insert into public.itext_blocks(blocker_id,blocked_id,scope) values($1,$2,'all')",[ONE,TWO]);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,0)
  await db.query('delete from public.itext_blocks where blocker_id=$1 and blocked_id=$2',[ONE,TWO]);await as(db,TWO);await db.query("select public.itext_message_action($1,'delete')",[message]);await as(db,ONE);assert.equal((await db.query('select * from public.itext_story_message_previews($1)',[[message]])).rows.length,0)
 }finally{await db.close()}
})

test('story audience paginates over fifty distinct viewers with the latest real viewer first and empty like/reply filters',async()=>{
 const db=await setup()
 try{
  await as(db,ONE);const story=(await db.query("insert into public.itext_stories(author_id,media_type,text_content) values($1,'text','Audience') returning id",[ONE])).rows[0].id
  await db.exec('reset role')
  for(let i=100;i<155;i++){const uid='00000000-0000-0000-0000-'+String(i).padStart(12,'0');await db.query('insert into auth.users(id) values($1)',[uid]);await db.query("insert into itext_private.story_views(story_id,viewer_id,last_seen_at) values($1,$2,clock_timestamp()+($3::integer*interval '1 second'))",[story,uid,i])}
  await as(db,ONE);const first=(await db.query("select public.itext_story_audience($1,'views',0) as a",[story])).rows[0].a,second=(await db.query("select public.itext_story_audience($1,'views',50) as a",[story])).rows[0].a
  assert.equal(first.views,55);assert.equal(first.rows.length,50);assert.equal(first.has_more,true);assert.equal(second.rows.length,5);assert.equal(second.has_more,false);assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,55)
  assert.equal(first.latest.id,'00000000-0000-0000-0000-000000000154');assert.equal(first.rows[0].id,first.latest.id)
  assert.equal((await db.query("select public.itext_story_audience($1,'likes',0) as a",[story])).rows[0].a.rows.length,0)
 }finally{await db.close()}
})
