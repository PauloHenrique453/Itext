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
