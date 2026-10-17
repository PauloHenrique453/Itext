import test from 'node:test'
import assert from 'node:assert/strict'
import * as openpgp from 'openpgp'
import { createVault, unlockVault, encryptMessage, decryptMessage, recoveryCode } from '../src/services/chatCrypto.js'

test('real OpenPGP encrypts for participants and creator; stranger, wrong code and tampering fail', async () => {
  const ids = ['sender', 'recipient', 'creator', 'stranger']
  const codes = Object.fromEntries(ids.map((id) => [id, recoveryCode()]))
  const records = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await createVault(id, codes[id])])))
  const keys = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await unlockVault(records[id], codes[id])])))
  for (const record of Object.values(records)) assert.equal((await openpgp.readPrivateKey({ armoredKey: record.encrypted_private_key })).isDecrypted(), false)
  await assert.rejects(unlockVault(records.sender, codes.stranger), /incorreto/)
  const row = await encryptMessage({ id: crypto.randomUUID(), sender_id: 'sender', recipient_id: 'recipient', owner_id: 'creator', body: 'Mensagem real e privada 🔐' }, records, keys.sender)
  assert.ok(!row.body.includes('Mensagem real'))
  assert.equal(row.encryption_version, 1)
  for (const id of ['sender', 'recipient', 'creator']) assert.equal((await decryptMessage(row, keys[id], records.sender)).plaintext, 'Mensagem real e privada 🔐')
  await assert.rejects(decryptMessage(row, keys.stranger, records.sender))
  await assert.rejects(decryptMessage({ ...row, recipient_id: 'stranger' }, keys.creator, records.sender), /não conferem/)
  await assert.rejects(decryptMessage(row, keys.creator, records.stranger))
  await assert.rejects(encryptMessage({ id: 'x', sender_id: 'sender', recipient_id: 'missing', owner_id: 'creator', body: 'No plaintext fallback' }, records, keys.sender), /ainda não ativou/)
  const legacy = await decryptMessage({ encryption_version: 0, body: 'antiga' }, keys.sender)
  assert.equal(legacy.legacy, true)
})
