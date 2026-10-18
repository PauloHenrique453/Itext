import test from 'node:test'
import assert from 'node:assert/strict'
import { enabledLoginProviders, loginOptions, readLoginCallback, loginErrorMessage } from '../src/services/loginOptions.js'

test('only real enabled OAuth services are displayed; disabled, unknown and email providers do not become fake buttons', () => {
  assert.deepEqual(enabledLoginProviders({ external: { google: true, github: false, azure: true, apple: 'true', discord: 'false', unknown: true, email: true } }).map((entry) => entry.id), ['google', 'azure'])
  assert.deepEqual(enabledLoginProviders(null), [])
})
test('Google always offers account selection, Microsoft requests email, and invitations survive the round trip', () => {
  const options = loginOptions('google', 'https://itext-1b9da.web.app', '?grupo=real-group&convite=private-invitation&next=https://untrusted.example')
  assert.equal(options.queryParams.prompt, 'select_account')
  assert.equal(options.scopes, 'openid email profile')
  const callback = new URL(options.redirectTo)
  assert.equal(callback.origin, 'https://itext-1b9da.web.app')
  assert.equal(callback.searchParams.get('grupo'), 'real-group')
  assert.equal(callback.searchParams.get('convite'), 'private-invitation')
  assert.equal(callback.searchParams.has('next'), false)
  assert.equal(loginOptions('azure', callback.origin).scopes, 'email')
  assert.equal(loginOptions('github', callback.origin).queryParams, undefined)
  assert.throws(() => loginOptions('unknown', callback.origin), /não está disponível/)
})
test('callback consumes PKCE codes and errors without losing group links or unrelated fragments', () => {
  const success = readLoginCallback('https://itext-1b9da.web.app/?grupo=one&convite=two&code=one-time-code#messages')
  assert.equal(success.code, 'one-time-code')
  assert.equal(success.cleaned, '/?grupo=one&convite=two#messages')
  const failure = readLoginCallback('https://itext-1b9da.web.app/?grupo=one#error=server_error&error_code=unexpected_failure&error_description=Client+secret+is+invalid&tab=welcome')
  assert.equal(failure.error, 'Client secret is invalid')
  assert.equal(failure.cleaned, '/?grupo=one#tab=welcome')
  const queryError = readLoginCallback('https://itext-1b9da.web.app/?error=access_denied&error_description=access_denied')
  assert.equal(queryError.error, 'access_denied')
  assert.equal(queryError.cleaned, '/')
})
test('login errors remain actionable across auth layers and never echo authorization codes into the page', () => {
  const safe = loginErrorMessage('invalid_client: The provided client secret is invalid; authorization-code=private-value')
  assert.match(safe, /responsável pelo Itext/)
  assert.equal(loginErrorMessage(new Error(safe)), safe)
  assert.ok(!safe.includes('private-value'))
  assert.match(loginErrorMessage(new Error('code verifier expired')), /expirou/)
  assert.match(loginErrorMessage(new Error('Failed to fetch')), /conexão/)
  assert.match(loginErrorMessage('access_denied'), /autorizado/)
  assert.equal(loginErrorMessage('unexpected server error with private-value'), 'Não foi possível concluir o login. Tente novamente.')
})

test('opening a shared story survives OAuth without accepting arbitrary redirect destinations',()=>{
 const id='00000000-0000-0000-0000-000000000001'
 const options=loginOptions('google','https://itext-1b9da.web.app','?story='+id+'&redirect_to=https://other.test&code=private')
 assert.equal(options.redirectTo,'https://itext-1b9da.web.app/?story='+id)
 assert.equal(readLoginCallback(options.redirectTo+'&code=one-time').cleaned,'/?story='+id)
})

test('Ishort video destinations survive Google sign-in without forwarding auth codes or other sites',()=>{
 const id='00000000-0000-0000-0000-000000000001'
 const options=loginOptions('google','https://itext-1b9da.web.app','?ishort='+id+'&redirect_to=https://other.test&code=private')
 assert.equal(options.redirectTo,'https://itext-1b9da.web.app/?ishort='+id)
 assert.equal(readLoginCallback(options.redirectTo+'&code=one-time').cleaned,'/?ishort='+id)
})
