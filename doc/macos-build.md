# macOS 安装与构建

从 v0.4.26 起，Release 同时提供 Intel 与 Apple Silicon 的 DMG。双架构构建、原生模块加载及签名检查已通过；首次公开提供 Mac 安装包，账号授权、设备权限和界面交互仍需更多 Mac 真机验证。

2026-10-28 首次双架构 CI 实测发现包内 SQLite 缺少 `bindings`。在打包清单补充 `bindings` 及其运行依赖 `file-uri-to-path` 后，[修复后的双架构构建](https://github.com/Nshpiter/Q-music/actions/runs/40639901248)已全部通过：Intel 与 Apple Silicon 均生成 DMG，并通过包内 SQLite、歌词原生模块加载及 ad-hoc 签名检查。该测试包包含本轮备用音源修复；Mac 真机交互验收仍未完成。

## 安装与更新

在 [Releases](https://github.com/Nshpiter/Q-music/releases/latest) 下载：Intel 芯片选 `Q-music-版本-x64.dmg`；M 系列芯片选 `Q-music-版本-arm64.dmg`。打开 DMG，将 Q-music 拖入「应用程序」。

包使用 ad-hoc 签名，未经过 Apple Developer ID 签名与公证。首次打开若被系统拦截，在「系统设置 → 隐私与安全性」确认允许打开。无需关闭系统安全检查。若仍被阻止，请反馈具体提示。

应用内会检查新版本并提供发布页入口。更新时退出 Q-music，再用新版 DMG 替换「应用程序」中的旧版，保留用户数据。当前不支持应用内自动安装；不生成会误导更新器的 `latest-mac.yml`。

## 构建流程

发布标签触发 **Build macOS**，两个 job 分别在 Intel 和 Apple Silicon 的 Mac runner 上安装依赖、构建 DMG，避免把另一种架构的 Electron / SQLite 带进安装包。通过检查后上传 DMG 与 SHA256 到对应 Release；全部平台资产齐全后才能公开发布。

也可从分支手动运行流程，只生成 Actions 测试产物，不创建或发布 Release。artifact 名为 `q-music-macos-x64-preview` 和 `q-music-macos-arm64-preview`。

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
