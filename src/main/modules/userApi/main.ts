import { mainSend } from '@common/mainIpc'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'node:path'
import { getProxy as getAppProxy, openDevTools as handleOpenDevTools } from '@main/utils'
import USER_API_RENDERER_EVENT_NAME from './rendererEvent/name'
import { getScript } from './utils'

const windows = new Map<string, Electron.BrowserWindow>()

let html: string | null = null
let dir: string | null = null

const denyEvents = [
  'will-navigate',
  'will-redirect',
  'will-attach-webview',
  'will-prevent-unload',
  'media-started-playing',
] as const


export const getProxy = () => {
  const proxy = getAppProxy()
  return proxy ?? { host: '', port: '' }
}
const handleUpdateProxy = (keys: Array<keyof LX.AppSetting>) => {
  if (keys.includes('network.proxy.enable') || (global.lx.appSetting['network.proxy.enable'] && keys.some(k => k.startsWith('network.proxy.')))) {
    for (const id of windows.keys()) sendEvent(id, USER_API_RENDERER_EVENT_NAME.proxyUpdate, getProxy())
  }
}

export const getRuntimeId = (sender: Electron.WebContents) => {
  for (const [id, window] of windows) if (window.webContents === sender) return id
  return null
}

export const createWindow = async(userApi: LX.UserApi.UserApiInfo, isCurrent: () => boolean = () => true) => {
  await closeWindow(userApi.id)
  dir ??= process.env.NODE_ENV !== 'production' ? webpackUserApiPath : path.join(__dirname, 'userApi')

  if (!html) {
    // eslint-disable-next-line require-atomic-updates
    html = await fs.promises.readFile(path.join(dir, 'renderer/user-api.html'), 'utf8')
  }
  const preloadUrl = process.env.NODE_ENV !== 'production'
    ? `${path.join(__dirname, '../dist/user-api-preload.js')}`
    : `${path.join(__dirname, 'user-api-preload.js')}`
  if (!isCurrent()) throw new Error('source changed')
  // console.log(preloadUrl)

  /**
   * Initial window options
   */
  const browserWindow = new BrowserWindow({
    // enableRemoteModule: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    roundedCorners: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      partition: `user-api-${userApi.id}-${Date.now()}`,
      contextIsolation: true,
      // worldSafeExecuteJavaScript: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: false,

      spellcheck: false,
      autoplayPolicy: 'document-user-activation-required',
      enableWebSQL: false,
      disableDialogs: true,
      // nativeWindowOpen: false,
      webgl: false,
      images: false,

      preload: preloadUrl,
    },
  })
  windows.set(userApi.id, browserWindow)

  for (const eventName of denyEvents) {
    // @ts-expect-error
    browserWindow.webContents.on(eventName, (event: Electron.Event) => {
      event.preventDefault()
    })
  }
  browserWindow.webContents.session.setPermissionRequestHandler((webContents, permission, resolve) => {
    resolve(false)
  })
  browserWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  browserWindow.on('closed', () => {
    if (windows.get(userApi.id) === browserWindow) windows.delete(userApi.id)
    if (!windows.size) global.lx.event_app.off('updated_config', handleUpdateProxy)
  })
  global.lx.event_app.off('updated_config', handleUpdateProxy)
  global.lx.event_app.on('updated_config', handleUpdateProxy)

  // console.log(html.replace('</body>', `<script>${userApi.script}</script></body>`))
  // const randomNum = Math.random().toString().substring(2, 10)
  await browserWindow.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html))

  const script = await getScript(userApi.id)
  if (isCurrent() && windows.get(userApi.id) === browserWindow && !browserWindow.isDestroyed()) {
    sendEvent(userApi.id, USER_API_RENDERER_EVENT_NAME.initEnv, { ...userApi, script, proxy: getProxy() })
  } else if (!browserWindow.isDestroyed()) browserWindow.destroy()
  return browserWindow

  // global.modules.userApiWindow.loadFile(join(dir, 'renderer/user-api.html'))
  // global.modules.userApiWindow.webContents.openDevTools()
}

export const closeWindow = async(id?: string) => {
  for (const [key, window] of [...windows]) {
    if (id && key !== id) continue
    windows.delete(key)
    if (window.isDestroyed()) continue
    const session = window.webContents.session
    window.destroy()
    // 每个脚本使用独立的内存会话，不能清理主窗口或其他脚本的会话。
    await Promise.all([session.clearAuthCache(), session.clearStorageData(), session.clearCache()])
  }
  if (!windows.size) global.lx.event_app.off('updated_config', handleUpdateProxy)
}

export const sendEvent = <T = any>(id: string, name: string, params?: T) => {
  const browserWindow = windows.get(id)
  if (!browserWindow) return
  mainSend(browserWindow, name, params)
}

export const openDevTools = (id: string) => {
  const browserWindow = windows.get(id)
  if (!browserWindow) return
  handleOpenDevTools(browserWindow.webContents)
}
