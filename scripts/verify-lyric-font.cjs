const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function fixture(native) {
  const changes = []
  const deps = {
    'react-native': { NativeModules: { LyricFontModule: native } },
    '@/core/common': { updateSetting: setting => changes.push(setting) },
  }
  const context = { exports: {}, require: name => {
    if (!(name in deps)) throw Error(name)
    return deps[name]
  } }
  const source = fs.readFileSync(path.join(__dirname, '../src/core/lyricFont.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  return { api: context.exports, changes }
}

test('启动注册已保存字体；不接受其他设备备份中的未注册字体', async() => {
  const saved = { family: 'qmusic-lyric-a', name: '中文字体.ttf' }
  const { api } = fixture({ load: async() => saved })
  assert.equal(api.getLyricFontFamily(saved.family), undefined)
  await api.initLyricFont()
  assert.equal(api.getLyricFontFamily(saved.family), saved.family)
  assert.equal(api.getImportedLyricFont(), saved)
  assert.equal(api.getLyricFontFamily('qmusic-lyric-other-device'), undefined)
  assert.equal(api.getLyricFontFamily(''), undefined)
  assert.equal(api.getLyricFontFamily('serif'), 'serif')
  assert.equal(api.getLyricFontFamily('monospace'), 'monospace')
})

test('文件丢失或旧测试包没有原生模块时安全回退默认字体', async() => {
  for (const native of [undefined, { load: async() => { throw Error('missing') } }]) {
    const { api, changes } = fixture(native)
    await api.initLyricFont()
    assert.equal(api.getImportedLyricFont(), null)
    assert.equal(api.getLyricFontFamily('qmusic-lyric-a'), undefined)
    assert.equal(changes.length, 0)
  }
})

test('只在原生导入成功后切换字体；失败保持旧字体和设置', async() => {
  const first = { family: 'qmusic-lyric-a', name: 'First.ttf' }
  const second = { family: 'qmusic-lyric-b', name: 'Second.otf' }
  const { api, changes } = fixture({
    load: async() => first,
    importFont: async file => { if (file == 'invalid') throw Error('bad font'); return second },
  })
  await api.initLyricFont()
  await assert.rejects(api.importLyricFont('invalid'))
  assert.equal(api.getImportedLyricFont(), first)
  assert.equal(changes.length, 0)
  await api.importLyricFont('valid.otf')
  assert.equal(api.getImportedLyricFont(), second)
  assert.equal(api.getLyricFontFamily(first.family), undefined)
  assert.equal(changes[0]['playDetail.style.font'], second.family)
})
