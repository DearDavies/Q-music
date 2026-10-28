# macOS 测试构建

桌面端已有 macOS 代码路径、图标及 Intel / Apple Silicon 歌词解码库。当前新增的是**测试构建流程**，尚未完成 Mac 真机验收，也未将 macOS 加入正式版自动发布。

2026-10-28 首次双架构 CI 实测：Apple Silicon 已生成 DMG 并通过签名检查，但包内 SQLite 加载检查发现缺少 `bindings`。已在打包清单补充 `bindings` 及其运行依赖 `file-uri-to-path`；修复后的 Mac CI 和真机验收尚未完成，当前不能将旧构建当作可用版本分发。

## 获取测试包

在 GitHub Actions 中手动运行 **Build macOS preview**。两个 job 分别在 Intel 和 Apple Silicon 的 Mac runner 上安装依赖、构建 DMG，避免把另一种架构的 Electron / SQLite 带进安装包。完成后下载对应的 `q-music-macos-x64-preview` 或 `q-music-macos-arm64-preview` artifact。

该流程只保存测试产物及 SHA256，不创建 Release、不修改版本、不上传正式版资产。包使用 ad-hoc 签名，未经过 Apple Developer ID 签名和公证；首次打开可能需要在“系统设置 → 隐私与安全性”中允许。无需关闭系统安全检查。

## 本机构建

需要 macOS 12 或更高版本、Node.js 22 和 Xcode Command Line Tools。在对应架构的 Mac 上执行：

```sh
npm ci
npm run build
# Intel
Q_MUSIC_MAC_ADHOC=true npm run pack:mac:dmg
# Apple Silicon（M 系列）
Q_MUSIC_MAC_ADHOC=true npm run pack:mac:dmg:arm64
```

仅运行与当前 Mac 架构相同的打包命令；不能只改目标参数就复用另一架构的原生依赖。

## 发布前验证

自动构建会检查代码、SQLite、歌词原生模块以及安装包签名。真机仍需验证：首次启动、账号授权与回调、播放与歌词、本地音乐与下载权限、菜单栏/窗口行为、快捷键及桌面歌词。

此阶段使用 DMG 手动安装更新。正式应用内自动更新还需要 Developer ID 签名、公证、ZIP 更新包及完整的 `latest-mac.yml`；不能直接沿用 Windows 的更新资产。
