const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { EventEmitter } = require('node:events')
const root = path.join(__dirname, '..')
const primary = 'user_api_primary', backup = 'user_api_backup', unused = 'user_api_unused'
const info = id => ({ id, name: id, sources: { tx: { type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } } })
const flush = async() => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function harness(t) {
  const handlers = new Map(), windows = new Map(), sent = [], statuses = [], created = []
  const appSetting = { 'common.apiBackupSources': [backup] }
  const event_app = new EventEmitter()
  const dependencies = {
    '@common/mainIpc': { mainOn: (name, handler) => handlers.set(name, handler) },
    './rendererEvent/name': { init: 'init', response: 'response', request: 'request', openDevTools: 'dev', getProxy: 'proxy', showUpdateAlert: 'update' },
    './utils': { getUserApis: () => [info(primary), info(backup), info(unused)] },
    '@main/modules/winMain': { sendStatusChange: value => statuses.push(value), sendShowUpdateAlert() {} },
    './main': {
      createWindow: async(api, isCurrent) => {
        if (!isCurrent()) throw Error('source changed')
        const window = new EventEmitter()
        window.webContents = new EventEmitter()
        window.isDestroyed = () => false
        window.destroy = () => { windows.delete(api.id); window.emit('closed') }
        windows.set(api.id, window)
        created.push(api.id)
        queueMicrotask(() => handlers.get('init')({ event: { sender: window.webContents }, params: { status: true, data: info(api.id) } }))
        return window
      },
      closeWindow: async id => { windows.get(id)?.destroy() },
      getRuntimeId: sender => [...windows].find(([, window]) => window.webContents === sender)?.[0] ?? null,
      getProxy: () => ({}), openDevTools() {}, sendEvent: (id, name, params) => sent.push({ id, name, params }),
    },
  }
  const context = { exports: {}, require: id => { assert.ok(id in dependencies, id); return dependencies[id] },
    setTimeout, clearTimeout, Date, global: { lx: { appSetting, event_app } },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/main/modules/userApi/runtime.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  const runtime = context.exports
  runtime.init()
  t.after(() => runtime.closeApis())
  const response = (id, key, value) => handlers.get('response')({ event: { sender: windows.get(id)?.webContents ?? {} }, params: { status: true, data: { requestKey: key, result: value } } })
  return { runtime, sent, created, statuses, response, appSetting, event_app }
}
test('desktop keeps one isolated runtime per enabled script and deduplicates initialization', async t => {
  const h = harness(t)
  await h.runtime.loadApi(primary)
  await Promise.all([h.runtime.getStatus(backup), h.runtime.getStatus(backup)])
  assert.deepEqual(h.created, [primary, backup])
  assert.deepEqual(h.statuses.map(status => status.apiInfo.id), [primary])
  await assert.rejects(h.runtime.getStatus(unused), /not enabled/)
})
test('a script cannot resolve another script’s request with a forged request key', async t => {
  const h = harness(t)
  await h.runtime.loadApi(primary)
  await h.runtime.getStatus(backup)
  let settled = false
  const pending = h.runtime.request({ apiId: primary, requestKey: 'a', data: {} }).then(result => { settled = true; return result })
  h.response(backup, 'a', 'forged')
  await flush()
  assert.equal(settled, false)
  h.response(primary, 'a', 'correct')
  assert.equal(await pending, 'correct')
})
test('cancellation and removal reject only affected requests; concurrent playback/download remains intact', async t => {
  const h = harness(t)
  await h.runtime.loadApi(primary)
  await h.runtime.getStatus(backup)
  const a = h.runtime.request({ apiId: primary, requestKey: 'a', data: {} })
  const b = h.runtime.request({ apiId: backup, requestKey: 'b', data: {} })
  const cancelled = assert.rejects(a, /Cancel request/)
  h.runtime.cancelRequest('a')
  h.response(primary, 'a', 'late')
  h.response(backup, 'b', 'download')
  await cancelled
  assert.equal(await b, 'download')
  const removed = h.runtime.request({ apiId: backup, requestKey: 'removed', data: {} })
  const rejected = assert.rejects(removed, /Cancel request/)
  h.appSetting['common.apiBackupSources'] = []
  h.event_app.emit('updated_config', ['common.apiBackupSources'])
  await rejected
  await assert.rejects(h.runtime.getStatus(backup), /not enabled/)
})
