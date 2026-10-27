// 由已打包的 Electron 执行，检查实际随包交付的 ABI、SQLite 和歌词解码库。
const assert = require('node:assert/strict')
const path = require('node:path')
const { createRequire } = require('node:module')
assert.equal(process.platform, 'darwin')
assert.ok(process.versions.electron, 'Use the packaged Electron runtime')
const archive = path.resolve(process.argv[2], 'Contents/Resources/app.asar')
const appRequire = createRequire(path.join(archive, 'package.json'))
const Database = appRequire('better-sqlite3')
const db = new Database(':memory:')
try { assert.equal(db.prepare('select 42 as result').get().result, 42) } finally { db.close() }
const decoder = appRequire('./build/Release/qrc_decode.node')
assert.equal(typeof decoder.qrc_decode, 'function')
console.log(`Packaged native modules OK: macOS ${process.arch}, Electron ${process.versions.electron}`)
