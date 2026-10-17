// OpenPGP multi-recipient encryption. The creator is an explicit recipient.
// Recovery codes and decrypted private keys must never be sent to the server.
const pgp = () => import('openpgp')
export const PRIVACY_NOTICE = 'creator-access-v1'

export function recoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').match(/.{8}/g).join('-')
}
function passphrase(code) {
  const value = code.replace(/[\s-]/g, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('Informe o código de recuperação completo, com 64 caracteres.')
  return value
}
async function publicKey(record) {
  if (!record) throw new Error('Uma das contas ainda não ativou as mensagens criptografadas.')
  const openpgp = await pgp()
  const key = await openpgp.readKey({ armoredKey: record.public_key })
  if (key.getFingerprint() !== record.fingerprint) throw new Error('A identificação da chave não confere.')
  return key
}
export async function createVault(userId, code) {
  const openpgp = await pgp()
  const keys = await openpgp.generateKey({ type: 'ecc', curve: 'curve25519', userIDs: [{ name: userId }], passphrase: passphrase(code), format: 'armored' })
  const key = await openpgp.readKey({ armoredKey: keys.publicKey })
  return { user_id: userId, public_key: keys.publicKey, encrypted_private_key: keys.privateKey, fingerprint: key.getFingerprint(), notice_version: PRIVACY_NOTICE }
}
export async function unlockVault(record, code) {
  const openpgp = await pgp()
  await publicKey(record)
  const encrypted = await openpgp.readPrivateKey({ armoredKey: record.encrypted_private_key })
  if (encrypted.isDecrypted()) throw new Error('A chave privada armazenada está sem proteção. Contate o criador.')
  let key
  try { key = await openpgp.decryptKey({ privateKey: encrypted, passphrase: passphrase(code) }) }
  catch { throw new Error('Código de recuperação incorreto. A chave não foi desbloqueada.') }
  if (key.getFingerprint() !== record.fingerprint) throw new Error('A chave privada não corresponde à conta.')
  return key
}
export async function encryptMessage(row, records, signingKey) {
  if (!row.body.trim() || row.body.trim().length > 4000) throw new Error('Mensagem inválida.')
  if (signingKey.getFingerprint() !== records[row.sender_id]?.fingerprint) throw new Error('A chave não pertence ao remetente.')
  const openpgp = await pgp()
  const keys = await Promise.all([...new Set([row.sender_id, row.recipient_id, row.owner_id])].map((id) => publicKey(records[id])))
  const envelope = { version: 1, id: row.id, sender_id: row.sender_id, recipient_id: row.recipient_id, owner_id: row.owner_id, text: row.body.trim() }
  const body = await openpgp.encrypt({ message: await openpgp.createMessage({ text: JSON.stringify(envelope) }), encryptionKeys: keys, signingKeys: signingKey, format: 'armored' })
  return { id: row.id, sender_id: row.sender_id, recipient_id: row.recipient_id, owner_id: row.owner_id, encryption_version: 1, body }
}
export async function decryptMessage(row, privateKey, sender) {
  if (row.encryption_version === 0) return { ...row, plaintext: row.body, legacy: true }
  if (row.encryption_version !== 1) throw new Error('Formato de mensagem desconhecido.')
  const openpgp = await pgp()
  const { data } = await openpgp.decrypt({ message: await openpgp.readMessage({ armoredMessage: row.body }), decryptionKeys: privateKey, verificationKeys: await publicKey(sender), expectSigned: true, format: 'utf8' })
  const envelope = JSON.parse(data)
  if (envelope.version !== 1 || ['id', 'sender_id', 'recipient_id', 'owner_id'].some((field) => envelope[field] !== row[field]) || typeof envelope.text !== 'string' || !envelope.text.trim() || envelope.text.length > 4000) throw new Error('A assinatura ou os dados da mensagem não conferem.')
  return { ...row, plaintext: envelope.text, legacy: false }
}
