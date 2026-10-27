const fs = require('fs').promises
const path = require('path')

// https://github.com/electron-userland/electron-builder/issues/4630
// https://github.com/electron-userland/electron-builder/issues/4630#issuecomment-782020139

module.exports = async(context) => {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return
  const { productFilename } = context.packager.appInfo
  const { macLanguagesInfoPlistStrings = {} } = context.packager.info.metadata

  const resPath = `${appOutDir}/${productFilename}.app/Contents/Resources`

  // 创建APP语言包文件
  return Promise.all(
    Object.entries(macLanguagesInfoPlistStrings).map(async([lang, config]) => {
      const directory = path.join(resPath, `${lang}.lproj`)
      await fs.mkdir(directory, { recursive: true })
      let infos = Object.entries(config).map(([k, v]) => `"${k}" = "${v}";`).join('\n')
      return fs.writeFile(path.join(directory, 'InfoPlist.strings'), infos)
    }),
  )
}
