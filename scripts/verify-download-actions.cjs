const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function fixture() {
  const task = { id: 'download', status: 'completed', filePath: '/Music/QMusic/song.flac', fileName: 'song.flac', musicInfo: { name: 'song', singer: 'artist', interval: '03:00', meta: { albumName: 'album', picUrl: 'cover', toggleMusicInfo: { source: 'tx' } } } }
  const state = { playMusicInfo: { musicInfo: null }, isPlay: false }
  const calls = []
  const controls = { exists: true, needsAccess: false, granted: true, removed: false, onExists: () => {} }
  const deps = {
    'react-native-fs': { default: { exists: async() => { controls.onExists(); return controls.exists } } },
    '@/config/constant': { LIST_IDS: { PLAY_LATER: 'playLater' } },
    '@/core/player/player': { playNext: async() => { calls.push('next') }, togglePlay: () => { calls.push('toggle') } },
    '@/store/player/action': { default: { addTempPlayList: list => { calls.push(list) } } },
    '@/store/player/state': { default: state },
    '@/utils/nativeModules/utils': { needsSharedFileAccess: async() => controls.needsAccess },
    '@/utils/tools': { requestStoragePermission: async() => controls.granted },
    './store': { getDownloadTask: () => controls.removed ? undefined : task },
  }
  const context = { exports: {}, require: id => { if (id in deps) return deps[id]; throw Error(id) } }
  const source = fs.readFileSync(path.join(__dirname, '../src/core/download/play.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return { ...context.exports, task, state, calls, controls }
}

test('下载完成后播放本地文件，不复制在线换源信息或替换用户歌单', async() => {
  const f = fixture()
  await f.playDownloadTask('download')
  assert.equal(f.calls.length, 2)
  const selected = f.calls[0][0]
  assert.equal(selected.musicInfo.source, 'local')
  assert.equal(selected.musicInfo.meta.filePath, f.task.filePath)
  assert.equal(selected.musicInfo.meta.ext, 'flac')
  assert.equal(selected.musicInfo.meta.toggleMusicInfo, undefined)
  assert.equal(selected.isTop, true)
  assert.equal(f.calls[1], 'next')
})

test('文件丢失、尚未完成或存储权限被拒绝时保持原播放队列', async() => {
  for (const scenario of ['missing', 'unfinished', 'denied']) {
    const f = fixture()
    if (scenario == 'missing') f.controls.exists = false
    if (scenario == 'unfinished') f.task.status = 'run'
    if (scenario == 'denied') { f.controls.needsAccess = true; f.controls.granted = false }
    await assert.rejects(f.playDownloadTask('download'), scenario == 'denied' ? /storage_all_files_unconfirmed/ : /download_play_missing/)
    assert.deepEqual(f.calls, [])
  }
})

test('检查文件期间下载记录被移除时不再入队', async() => {
  const f = fixture()
  f.controls.onExists = () => { f.controls.removed = true }
  await assert.rejects(f.playDownloadTask('download'), /download_play_missing/)
  assert.deepEqual(f.calls, [])
})

test('再次点击当前本地歌曲只切换播放状态，不重复入队', async() => {
  for (const isPlay of [true, false]) {
    const f = fixture()
    f.state.playMusicInfo.musicInfo = { source: 'local', meta: { filePath: f.task.filePath } }
    f.state.isPlay = isPlay
    await f.playDownloadTask('download')
    assert.deepEqual(f.calls, ['toggle'])
  }
})
