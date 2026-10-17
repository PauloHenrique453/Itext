import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { mergeMessages } from '../src/services/messaging.js'

test('message merge deduplicates sends and realtime deliveries without losing chronological order', () => {
  const a={id:'a',created_at:'2026-10-17T12:00:00Z',body:'a'}
  const b={id:'b',created_at:'2026-10-17T12:00:01Z',body:'b'}
  assert.deepEqual(mergeMessages([b],[a,b]),[a,b])
})

test('Postgres enforces participant-only chat access and rejects sender impersonation', async () => {
  const db=new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon;`)
    await db.exec(readFileSync('supabase/google-chat.sql','utf8'))
    const one='00000000-0000-0000-0000-000000000001'
    const two='00000000-0000-0000-0000-000000000002'
    const three='00000000-0000-0000-0000-000000000003'
    await db.query(`insert into auth.users(id,raw_user_meta_data) values ($1,'{"full_name":"Pessoa um"}'),($2,'{"full_name":"Pessoa dois"}'),($3,'{"full_name":"Pessoa três"}')`,[one,two,three])
    assert.equal((await db.query('select * from public.chat_profiles')).rows.length,3)
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[one])
    await db.query('insert into public.direct_messages(sender_id,recipient_id,body) values ($1,$2,$3)',[one,two,'mensagem privada'])
    await assert.rejects(db.query('insert into public.direct_messages(sender_id,recipient_id,body) values ($1,$2,$3)',[two,three,'falsificado']))
    await assert.rejects(db.query('insert into public.direct_messages(sender_id,recipient_id,body,created_at) values ($1,$2,$3,now())',[one,two,'timestamp forjado']))
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[three])
    assert.equal((await db.query('select * from public.direct_messages')).rows.length,0)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[two])
    assert.equal((await db.query('select * from public.direct_messages')).rows[0].body,'mensagem privada')
    await db.exec('reset role; set role anon')
    await assert.rejects(db.query('select * from public.direct_messages'))
    await assert.rejects(db.query('select * from public.chat_profiles'))
  } finally { await db.close() }
})
