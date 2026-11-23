const { createHash, randomUUID } = require('node:crypto')

const FARM_APP_ID = 'wx5306c5978fdb76e4'
const SESSION_MS = 5 * 60 * 1000
const MAX_SESSIONS = 32
const UNAVAILABLE = '本机微信扫码服务不可用，请确认服务已启动'
const SAVE_ERROR = '微信账号保存失败，请重试'

class WechatQrError extends Error {}

function localOrigin(url) {
  try {
    const parsed = new URL(url)
    if (['http:', 'https:'].includes(parsed.protocol)
      && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
      && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      return parsed.origin
    }
  } catch {
    // Invalid or missing service configuration.
  }
  return ''
}

function getFarmCode(result) {
  let data = result?.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      data = null
    }
  }
  const code = [result?.code, data?.code].find(value => typeof value === 'string' && value.trim())
  if (!code) {
    throw new WechatQrError('微信已授权，但未取得农场登录 Code，请重新扫码')
  }
  return code.trim()
}

function createWechatQrLogin({ url, token, validateAccount = () => '', saveAccount, fetchImpl = fetch, now = Date.now }) {
  const origin = localOrigin(url)
  const sessions = new Map()
  let creating = 0

  async function request(path, body, timeout = 6000) {
    try {
      return await fetchImpl(origin + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
      })
    } catch {
      throw new WechatQrError(UNAVAILABLE)
    }
  }

  async function call(path, body, timeout) {
    const response = await request(path, body, timeout)
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.code !== 0) {
      const message = path === '/wxapp/getCode'
        ? '微信已授权，但取码失败，请重新扫码'
        : UNAVAILABLE
      throw new WechatQrError(message)
    }
    return result.data
  }

  function findSession(owner, id) {
    const session = sessions.get(id)
    if (session?.owner === owner && session.expiresAt > now()) return session
  }

  async function create(owner, { accountId = '', name = '' } = {}) {
    if (!origin || !token) throw new WechatQrError('未配置本机微信扫码服务')
    const conflict = validateAccount(accountId)
    if (conflict) throw new WechatQrError(conflict)
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now()) sessions.delete(id)
    }
    if (sessions.size + creating >= MAX_SESSIONS) {
      throw new WechatQrError('扫码请求过多，请稍后重试')
    }

    creating++
    let path = ''
    try {
      const data = await call('/wx/qrcodeauth', {})
      if (!data?.session_id) throw new WechatQrError(UNAVAILABLE)
      path = `/wx/qrcodeauth/${encodeURIComponent(data.session_id)}`
      const response = await request(`${path}/image`)
      const contentType = response.headers.get('content-type')?.split(';')[0]
      if (!response.ok || !['image/png', 'image/jpeg'].includes(contentType)) {
        throw new WechatQrError(UNAVAILABLE)
      }
      const image = Buffer.from(await response.arrayBuffer()).toString('base64')
      const id = randomUUID()
      sessions.set(id, { owner, path, accountId, name, expiresAt: now() + SESSION_MS })
      return { id, image: `data:${contentType};base64,${image}` }
    } catch {
      if (path) await call(`${path}/cancel`, {}).catch(() => {})
      throw new WechatQrError(UNAVAILABLE)
    } finally {
      creating--
    }
  }

  async function poll(session) {
    const { path, accountId } = session
    let data
    try {
      // The service's pending response can take about 15 seconds.
      data = await call(`${path}/poll`, undefined, 25000)
      session.pollFailures = 0
    } catch {
      if (session.result) return session.result
      session.pollFailures = (session.pollFailures || 0) + 1
      if (session.pollFailures < 3) return { status: 'retrying' }
      throw new WechatQrError('微信扫码状态暂时无法查询，请刷新二维码后重试')
    }
    if (session.result) return session.result
    if (data?.status === 'pending' || data?.status === 'scanned') return { status: data.status }
    if (data?.status !== 'authorized') {
      session.result = { status: data?.status === 'cancelled' ? 'cancelled' : 'expired' }
      return session.result
    }

    const account = await call(`${path}/confirm`, {})
    if (session.result) return session.result
    if (!account?.openid || !account.id) throw new WechatQrError('无法确认微信账号身份，请重新扫码')
    const identity = createHash('sha256').update(account.openid).digest('hex')
    const conflict = validateAccount(accountId, identity)
    if (conflict) throw new WechatQrError(conflict)

    const reply = await call('/wxapp/getCode', { ref: String(account.id), app_id: FARM_APP_ID }, 20000)
    if (session.result) return session.result
    if (session.expiresAt <= now()) {
      session.result = { status: 'expired' }
      return session.result
    }
    if (reply?.openid && reply.openid !== account.openid) {
      throw new WechatQrError('无法确认微信账号身份，请重新扫码')
    }
    const error = saveAccount({ accountId, identity, code: getFarmCode(reply?.result), name: session.name || account.nickname || '微信扫码账号' })
    if (error) throw new WechatQrError(error)
    session.result = { status: 'complete' }
    return session.result
  }

  async function check(owner, id) {
    const session = findSession(owner, id)
    if (!session) return { status: 'expired' }
    if (session.result) return session.result
    if (!session.pending) {
      session.pending = poll(session).catch((error) => {
        session.result ??= { status: 'error', error: error instanceof WechatQrError ? error.message : SAVE_ERROR }
        return session.result
      }).finally(() => { session.pending = null })
    }
    return session.pending
  }

  async function cancel(owner, id) {
    const session = findSession(owner, id)
    if (!session || session.result) return
    session.result = { status: 'cancelled' }
    await call(`${session.path}/cancel`, {}).catch(() => {})
  }

  return { create, check, cancel }
}

module.exports = { createWechatQrLogin }
