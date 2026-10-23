const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = false
const prefix = mobile ? 'c-' : '--color-'
const imageKey = mobile ? 'bg-image' : '--background-image'
function load(relative) {
  const file = path.join(root, relative)
  if (!file.endsWith('.ts')) return require(file)
  const context = {
    exports: {},
    require: id => {
      const base = path.resolve(path.dirname(file), id)
      return load(path.relative(root, fs.existsSync(base + '.ts') ? base + '.ts' : base + '.js'))
    },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const api = load(mobile ? 'src/theme/appearance.ts' : 'src/common/theme/appearance.ts')
const themes = mobile ? load('src/theme/themes/themes.ts').default : require('../src/common/theme/index.json')

test('升级沿用当前配色，旧系统和定时设置映射为独立外观模式', () => {
  assert.equal(api.getBaseThemeId({ 'theme.id': 'china_ink', 'theme.autoByTime': true }), 'china_ink')
  assert.equal(api.getBaseThemeId({ 'theme.id': 'auto', 'theme.lightId': 'pink', 'theme.darkId': 'black' }), 'pink')
  assert.equal(api.getThemeAppearance({ 'theme.id': 'auto' }), 'system')
  assert.equal(api.getThemeAppearance({ 'theme.autoByTime': true }), 'time')
  assert.equal(api.getThemeAppearance({}, true), 'dark')
  assert.equal(api.getThemeAppearance({ 'theme.appearance': 'light', 'theme.autoByTime': true, 'theme.id': 'auto' }), 'light')
  if (mobile) assert.equal(api.getThemeAppearance({ 'common.isAutoTheme': true }), 'system')
})

test('四种外观模式独立处理系统状态、日夜边界和时间模式优先级', () => {
  for (const systemDark of [false, true]) {
    assert.equal(api.isDarkAppearance('light', systemDark), false)
    assert.equal(api.isDarkAppearance('dark', systemDark), true)
    assert.equal(api.isDarkAppearance('system', systemDark), systemDark)
    for (const [hour, minute, dark] of [[6, 59, true], [7, 0, false], [18, 59, false], [19, 0, true], [0, 0, true]]) {
      assert.equal(api.isDarkAppearance('time', systemDark, new Date(2026, 9, 23, hour, minute)), dark)
    }
  }
})

test('全部内置主题保留名称、背景和原始定义，系统来回切换不累积改色', () => {
  for (const theme of themes) {
    const original = JSON.stringify(theme)
    for (const dark of [true, false, true, false]) {
      const next = api.adaptThemeAppearance(theme, dark)
      assert.equal(next.id, theme.id)
      assert.equal(next.name, theme.name)
      assert.equal(next.isDark, dark)
      assert.equal(next.config.extInfo[imageKey], theme.config.extInfo[imageKey])
      assert.equal(JSON.stringify(theme), original)
      if (dark == theme.isDark) assert.equal(next, theme)
      for (const value of Object.values(next.config.themeColors)) assert.ok(!/NaN|undefined/.test(value), theme.id)
    }
  }
})

const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)

test('夜间彩色和水墨主题保持可读对比度，自定义背景不丢失', () => {
  for (const theme of themes.filter(theme => !theme.isDark)) {
    const next = api.adaptThemeAppearance(theme, true)
    const colors = next.config.themeColors
    const surface = luminance(colors[prefix + 'primary-light-1000'])
    for (const key of ['primary', '850']) {
      assert.ok((luminance(colors[prefix + key]) + 0.05) / (surface + 0.05) >= 4.5, `${theme.id}: ${key}`)
    }
    assert.ok(surface < 0.03, theme.id)
  }
  const custom = structuredClone(themes[0])
  custom.isCustom = true
  custom.config.themeColors[prefix + 'primary'] = '#913'
  custom.config.extInfo[imageKey] = 'my-background.png'
  const dark = api.adaptThemeAppearance(custom, true)
  assert.equal(dark.config.extInfo[imageKey], 'my-background.png')
  assert.notEqual(dark.config.themeColors[prefix + 'primary'], themes.find(theme => theme.id == 'black').config.themeColors[prefix + 'primary'])
})
