import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('only configured creator can review all messages; users cannot promote themselves, replace keys or read another vault', async () => {
  const db = new PGlite()
  const ids = Array.from({ length: 4 }, (_, index) => `00000000-0000-0000-0000-00000000000${index + 1}`)
  const [one, two, creator, stranger] = ids
  const as = async (id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]) }
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon;`)
    await db.exec(readFileSync('supabase/google-chat.sql', 'utf8'))
    for (const id of ids) await db.query('insert into auth.users(id) values($1)', [id])
    await as(one)
    await db.query('insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,$3)', [one,two,'legacy message'])
    await db.exec('reset role')
    await db.exec(readFileSync('supabase/creator-privacy.sql', 'utf8'))
    await db.query('insert into public.itext_chat_privacy(owner_id) values($1)', [creator])
    const publicKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\n' + 'x'.repeat(150)
    const vault = '-----BEGIN PGP PRIVATE KEY BLOCK-----\n' + 'y'.repeat(150)
    for (const id of ids) {
      await as(id)
      await db.query('insert into public.itext_chat_keys(user_id,public_key,encrypted_private_key,fingerprint,notice_version) values($1,$2,$3,$4,$5)', [id,publicKey,vault,'a'.repeat(40),'creator-access-v1'])
    }
    await as(one)
    assert.equal((await db.query('select * from public.itext_chat_keys')).rows.length,1)
    assert.equal((await db.query('select * from public.itext_chat_public_keys')).rows.length,4)
    await assert.rejects(db.query('select encrypted_private_key from public.itext_chat_public_keys'))
    await assert.rejects(db.query('update public.itext_chat_keys set public_key=$1', [publicKey]))
    await assert.rejects(db.query('delete from public.itext_chat_keys'))
    await assert.rejects(db.query('update public.itext_chat_privacy set owner_id=$1',[one]))
    await assert.rejects(db.query('insert into public.itext_chat_privacy(owner_id) values($1)',[one]))
    await assert.rejects(db.query('insert into public.itext_chat_keys(user_id,public_key,encrypted_private_key,fingerprint,notice_version) values($1,$2,$3,$4,$5)', [stranger,publicKey,vault,'b'.repeat(40),'creator-access-v1']))
    const cipher = '-----BEGIN PGP MESSAGE-----\n' + 'z'.repeat(6000)
    await db.query('insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,owner_id) values($1,$2,$3,1,$4)',[one,two,cipher,creator])
    await assert.rejects(db.query('insert into public.direct_messages(sender_id,recipient_id,body) values($1,$2,$3)',[one,two,'new plaintext']))
    await assert.rejects(db.query('insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,owner_id) values($1,$2,$3,1,$4)',[one,two,cipher,stranger]))
    await assert.rejects(db.query('insert into public.direct_messages(sender_id,recipient_id,body,encryption_version,owner_id) values($1,$2,$3,1,$4)',[two,one,cipher,creator]))
    await as(stranger)
    assert.equal((await db.query('select * from public.direct_messages')).rows.length,0)
    assert.equal((await db.query('select public.itext_is_creator() as allowed')).rows[0].allowed,false)
    await db.query(`update public.chat_profiles set name='Criador' where id=$1`,[stranger])
    assert.equal((await db.query('select public.itext_is_creator() as allowed')).rows[0].allowed,false)
    await as(two)
    assert.equal((await db.query('select * from public.direct_messages')).rows.length,2)
    await as(creator)
    assert.equal((await db.query('select public.itext_is_creator() as allowed')).rows[0].allowed,true)
    assert.equal((await db.query('select * from public.direct_messages')).rows.length,2)
    assert.equal((await db.query('select * from public.itext_chat_keys')).rows.length,1)
    await db.exec('reset role; set role anon')
    for (const name of ['direct_messages','itext_chat_keys','itext_chat_privacy','itext_chat_public_keys']) await assert.rejects(db.query(`select * from public.${name}`))
    assert.equal((await db.query('select public.itext_crypto_ready() as ready')).rows[0].ready,true)
  } finally { await db.close() }
})
