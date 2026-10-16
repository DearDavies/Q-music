const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, setTimeout, clearTimeout, Number, console: { log() {} }, window: { i18n: { t: key => key } }, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const timeout = load('src/renderer/store/browseRequest.ts')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const result = (name, source = 'wy') => ({ list: [{ id: name, name }], total: 1, limit: 30, page: 1, source, info: { name } })
function harness(kind) {
  const calls = []
  const request = (...args) => { const gate = deferred(); calls.push({ args, ...gate }); return gate.promise }
  const state = { boards: {}, tags: {}, listInfo: { list: [] }, listDetailInfo: { list: [], info: {} } }
  const sdk = { getList: request, getListDetail: request, getBoards: async () => ({ source: 'wy', list: [] }) }
  const api = load(`src/renderer/store/${kind}/action.ts`, {
    '@renderer/utils': { deduplicationList: x => x, toNewMusicInfo: x => x },
    '@renderer/utils/musicSdk': { wy: { leaderboard: sdk, songList: sdk }, kw: { songList: sdk } },
    '@common/utils/vueTools': { markRaw: x => x, markRawList: x => x },
    './state': state,
    '../browseRequest': timeout,
  })
  return { api, state, calls }
}

test('排行榜 A → B 立即清空旧内容，A 迟到不能覆盖 B', async () => {
  const { api, state, calls } = harness('leaderboard')
  state.listDetailInfo.list = [{ id: 'old' }]
  const a = api.getAndSetListDetail('wy__a', 1)
  const b = api.getAndSetListDetail('wy__b', 1)
  assert.equal(state.listDetailInfo.list.length, 0)
  assert.equal(state.listDetailInfo.id, 'wy__b')
  calls[1].resolve(result('B')); await b
  calls[0].resolve(result('A')); await a
  assert.equal(state.listDetailInfo.list[0].name, 'B')
})

test('歌单最新 → 最热 → 最新使用本次请求，旧同名请求不能覆盖', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetList('kw', '', 'new', 1)
  const b = api.getAndSetList('kw', '', 'hot', 1)
  const c = api.getAndSetList('kw', '', 'new', 1)
  calls[2].resolve(result('new-current', 'kw')); await c
  calls[1].resolve(result('hot', 'kw')); await b
  calls[0].resolve(result('new-stale', 'kw')); await a
  assert.equal(state.listInfo.list[0].name, 'new-current')
  await api.getAndSetList('kw', '', 'new', 1)
  assert.equal(calls.length, 3)
})

test('歌单取消旧请求后不重试干扰新排序', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetList('kw', '', 'new', 1)
  const b = api.getAndSetList('kw', '', 'hot', 1)
  calls[0].reject(Error('cancelled')); await a
  calls[1].resolve(result('hot', 'kw')); await b
  assert.equal(calls.length, 2)
  assert.equal(state.listInfo.sortId, 'hot')
})

test('切换至已缓存歌单会使未完成请求失效', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetList('kw', '', 'new', 1)
  calls[0].resolve(result('new', 'kw')); await a
  const b = api.getAndSetList('kw', '', 'hot', 1)
  await api.getAndSetList('kw', '', 'new', 1)
  calls[1].resolve(result('hot', 'kw')); await b
  assert.equal(state.listInfo.list[0].name, 'new')
})

test('歌单详情同 ID 的强制刷新拒绝更早响应', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetListDetail('a', 'wy', 1)
  const b = api.getAndSetListDetail('a', 'wy', 1, true)
  calls[1].resolve(result('fresh')); await b
  calls[0].resolve(result('stale')); await a
  assert.equal(state.listDetailInfo.list[0].name, 'fresh')
  assert.equal((await api.getListDetail('a', 'wy', 1)).list[0].name, 'fresh')
})

test('歌单请求失败后保留筛选条件，并允许原条件重试', async () => {
  const { api, state, calls } = harness('songList')
  const failed = assert.rejects(api.getAndSetList('kw', 'rock', 'hot', 2), /offline/)
  for (let i = 0; i < 3; i++) {
    while (!calls[i]) await new Promise(resolve => setTimeout(resolve, 20))
    calls[i].reject(Error('offline'))
  }
  await failed
  assert.equal(state.listInfo.source, 'kw')
  assert.equal(state.listInfo.tagId, 'rock')
  assert.equal(state.listInfo.sortId, 'hot')
  assert.equal(state.listInfo.page, 2)
  const retry = api.getAndSetList('kw', 'rock', 'hot', 2)
  calls[3].resolve(result('recovered', 'kw')); await retry
  assert.equal(state.listInfo.list[0].name, 'recovered')
  assert.equal(state.listInfo.noItemLabel, '')
})

test('清空排行榜使在途请求失效', async () => {
  const { api, state, calls } = harness('leaderboard')
  const a = api.getAndSetListDetail('wy__a', 1)
  api.clearListDetail()
  calls[0].resolve(result('stale')); await a
  assert.equal(state.listDetailInfo.list.length, 0)
  assert.equal(state.listDetailInfo.id, '')
})

test('永不返回的请求有超时，正常请求不遗留定时器', async () => {
  await assert.rejects(timeout.withBrowseTimeout(new Promise(() => {}), 10), /timed out/)
  assert.equal(await timeout.withBrowseTimeout(Promise.resolve('ok'), 100), 'ok')
})
