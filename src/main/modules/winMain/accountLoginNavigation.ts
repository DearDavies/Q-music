import { allowOfficialNavigation } from '../../utils/navigationPolicy'

// 部分旧版授权页仍返回 HTTP 回调；只升级已知官网地址，不放行明文授权。
export const upgradeAccountLoginNavigation = (provider: string, target: string): string => {
  try {
    const url = new URL(target)
    if (url.protocol != 'http:' || url.username || url.password || url.port) return target
    const callback = provider == 'wy' && url.hostname == 'music.163.com' && /^\/back\/(?:qq|weixin)(?:\/|$)/.test(url.pathname)
    const qqCallback = provider == 'tx' && url.hostname == 'y.qq.com' && url.pathname == '/portal/wx_redirect.html'
    if (callback || qqCallback) { url.protocol = 'https:'; return url.href }
  } catch {}
  return target
}

// 网易云的第三方登录必须留在同一个账号会话内，不能交给系统浏览器。
// 仅放行 QQ 授权站点，不把 QQ 音乐自己的账号页面混入网易云登录。
export const allowAccountLoginNavigation = (provider: string, target: string, domains: readonly string[]) => {
  target = upgradeAccountLoginNavigation(provider, target)
  if (allowOfficialNavigation(target, domains)) return true
  return provider == 'wy' && allowOfficialNavigation(target, ['graph.qq.com', 'ptlogin2.qq.com', 'open.weixin.qq.com'])
}
