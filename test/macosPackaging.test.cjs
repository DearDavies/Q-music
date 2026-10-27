const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const afterPack = require('../build-config/build-after-pack')

test('macOS 打包首次创建语言目录，使用公开 metadata 接口且可重复执行', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qmusic-macos-pack-'))
  const context = {
    electronPlatformName: 'darwin', appOutDir: directory,
    packager: { appInfo: { productFilename: 'Q-music' }, info: { metadata: {
      macLanguagesInfoPlistStrings: { en: { CFBundleName: 'Q-music' }, zh_CN: { CFBundleDisplayName: 'Q-music' } },
    } } },
  }
  await afterPack(context)
  await afterPack(context)
  assert.equal(await fs.readFile(path.join(directory, 'Q-music.app/Contents/Resources/zh_CN.lproj/InfoPlist.strings'), 'utf8'), '"CFBundleDisplayName" = "Q-music";')
})

test('非 macOS 打包不访问 Mac 专用 metadata', async () => {
  await afterPack({ electronPlatformName: 'win32' })
  await afterPack({ electronPlatformName: 'linux' })
})
