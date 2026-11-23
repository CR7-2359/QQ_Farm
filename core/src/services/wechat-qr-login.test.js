const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createWechatQrLogin } = require('./wechat-qr-login')

function setup({ states = ['authorized'], validateAccount, getCode } = {}) {
  const calls = []
  const accounts = []
  let time = 0
  const login = createWechatQrLogin({
    url: 'http://127.0.0.1:18427',
    token: 'local-provider-token',
    now: () => time,
    validateAccount,
    saveAccount(account) {
      accounts.push(account)
    },
    async fetchImpl(url, options) {
      assert.equal(options.headers.Authorization, 'Bearer local-provider-token')
      const endpoint = new URL(url).pathname.split('/').at(-1)
      calls.push(endpoint)
      if (endpoint === 'image') {
        return new Response(Buffer.from('test image'), { headers: { 'Content-Type': 'image/jpeg' } })
      }
      const scanStatus = endpoint === 'poll' ? states.shift() : undefined
      if (scanStatus instanceof Error)
        throw scanStatus
      const data = {
        qrcodeauth: { session_id: 'provider-id' },
        poll: { status: scanStatus },
        confirm: { id: 1, openid: 'provider-identity', nickname: 'Test' },
        cancel: {},
      }
      if (endpoint === 'getCode') {
        if (getCode)
          await getCode()
        return Response.json({ code: 0, data: { result: { code: 0, data: '{"code":"farm-code"}' } } })
      }
      assert.ok(data[endpoint], endpoint)
      return Response.json({ code: 0, data: data[endpoint] })
    },
  })
  return { login, calls, accounts, advance: milliseconds => time += milliseconds }
}

test('reports scan progress and saves once under concurrent checks', async () => {
  const { login, calls, accounts } = setup({ states: ['pending', 'scanned', 'authorized'] })
  const { id, image } = await login.create('owner', { name: 'Remark' })
  assert.match(image, /^data:image\/jpeg;base64,/)
  assert.notEqual(id, 'provider-id')
  assert.deepEqual(await login.check('owner', id), { status: 'pending' })
  assert.deepEqual(await login.check('owner', id), { status: 'scanned' })
  const results = await Promise.all([login.check('owner', id), login.check('owner', id)])
  assert.deepEqual(results, [{ status: 'complete' }, { status: 'complete' }])
  assert.deepEqual(await login.check('owner', id), { status: 'complete' })
  assert.equal(calls.filter(call => call === 'getCode').length, 1)
  assert.equal(accounts.length, 1)
  assert.equal(accounts[0].name, 'Remark')
  assert.equal(accounts[0].code, 'farm-code')
  assert.match(accounts[0].identity, /^[0-9a-f]{64}$/)
})

test('rejects a mismatched identity before requesting or saving a farm code', async () => {
  const { login, calls, accounts } = setup({
    validateAccount(accountId, identity) {
      assert.equal(accountId, '42')
      if (identity)
        return '微信账号与原账号不一致'
    },
  })
  const { id } = await login.create('owner', { accountId: '42' })
  assert.deepEqual(await login.check('owner', id), { status: 'error', error: '微信账号与原账号不一致' })
  assert.equal(calls.includes('getCode'), false)
  assert.equal(accounts.length, 0)
})

test('sessions expire, are owner-bound, and support cancellation', async () => {
  const { login, advance, calls } = setup()
  const { id } = await login.create('owner')
  assert.deepEqual(await login.check('other', id), { status: 'expired' })
  await login.cancel('other', id)
  await login.cancel('owner', id)
  assert.deepEqual(await login.check('owner', id), { status: 'cancelled' })
  assert.equal(calls.filter(call => call === 'cancel').length, 1)
  const next = await login.create('owner')
  advance(6 * 60 * 1000)
  assert.deepEqual(await login.check('owner', next.id), { status: 'expired' })
  assert.equal(calls.includes('poll'), false)
})

test('does not save if cancelled while the farm code is in flight', async () => {
  let releaseCode
  let codeStarted
  const started = new Promise(resolve => codeStarted = resolve)
  const { login, accounts } = setup({
    getCode: () => new Promise(resolve => {
      releaseCode = resolve
      codeStarted()
    }),
  })
  const { id } = await login.create('owner')
  const check = login.check('owner', id)
  await started
  await login.cancel('owner', id)
  releaseCode()
  assert.deepEqual(await check, { status: 'cancelled' })
  assert.equal(accounts.length, 0)
})

test('reports unconfigured or offline providers without exposing secrets', async () => {
  const config = { token: 'secret-token', fetchImpl: async () => { throw new Error('secret-token') } }
  const external = createWechatQrLogin({ ...config, url: 'https://example.com' })
  await assert.rejects(external.create('owner'), /未配置/)
  const local = createWechatQrLogin({ ...config, url: 'http://127.0.0.1:18427' })
  await assert.rejects(local.create('owner'), /本机微信扫码服务不可用/)
})

test('keeps a QR session active after a transient provider polling failure', async () => {
  const { login, accounts } = setup({ states: [new Error('temporary timeout'), 'authorized'] })
  const { id } = await login.create('owner')
  assert.deepEqual(await login.check('owner', id), { status: 'retrying' })
  assert.deepEqual(await login.check('owner', id), { status: 'complete' })
  assert.equal(accounts.length, 1)
})
