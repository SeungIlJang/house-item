import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

test('native login binds callbacks to the initiating app, ignores unrelated links, and cleans up', async () => {
  const values = new Map()
  const listeners = new Map()
  let opened
  let notifyOpen
  const didOpen = new Promise((resolve) => { notifyOpen = resolve })
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  globalThis.__authMocks = {
    App: { async addListener(name, callback) {
      listeners.set(name, callback)
      return { async remove() { listeners.delete(name) } }
    } },
    Browser: {
      async addListener(name, callback) {
        listeners.set(name, callback)
        return { async remove() { listeners.delete(name) } }
      },
      async open({ url }) { opened = url; notifyOpen() },
      async close() {},
    },
    Capacitor: { isNativePlatform: () => true },
  }
  let source = await readFile(new URL('../src/services/socialAuth.ts', import.meta.url), 'utf8')
  source = source
    .replace("import { App } from '@capacitor/app'", 'const { App } = globalThis.__authMocks')
    .replace("import { Browser } from '@capacitor/browser'", 'const { Browser } = globalThis.__authMocks')
    .replace("import { Capacitor } from '@capacitor/core'", 'const { Capacitor } = globalThis.__authMocks')
    .replace("import { API_BASE_URL } from '@/api/client'", "const API_BASE_URL = 'https://api.example/api/v1'")
    .replace("import { tr } from '@/i18n'", 'const tr = (ko) => ko')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  const auth = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const result = auth.signInWith('google')
  await didOpen
  const state = new URL(opened).searchParams.get('login_state')
  assert.match(state, /^[a-f0-9]{64}$/)
  assert.equal(auth.isAuthCallbackUrl('https://evil.example/auth?token=bad'), false)
  assert.equal(auth.isAuthCallbackUrl('com.homeitems.app://other?token=bad'), false)
  assert.throws(() => auth.readCallbackUrl('com.homeitems.app://auth?token=bad&state=wrong'), { code: 'INVALID_STATE' })
  assert.equal(auth.consumeCallbackUrl(`com.homeitems.app://auth?token=valid-token&state=${state}`), true)
  assert.equal(await result, 'valid-token')
  await Promise.resolve()
  assert.equal(listeners.size, 0)
  const pending = JSON.parse(values.get('home_items_login_state'))
  pending.expiresAt = 0
  values.set('home_items_login_state', JSON.stringify(pending))
  assert.throws(() => auth.readCallbackUrl(`com.homeitems.app://auth?token=valid-token&state=${state}`), { code: 'INVALID_STATE' })
  delete globalThis.__authMocks
  delete globalThis.localStorage
})
