import { allowOfficialNavigation } from '../../utils/navigationPolicy'

// 网易云的第三方登录必须留在同一个账号会话内，不能交给系统浏览器。
// 仅放行 QQ 授权站点，不把 QQ 音乐自己的账号页面混入网易云登录。
export const allowAccountLoginNavigation = (provider: string, target: string, domains: readonly string[]) => {
  if (allowOfficialNavigation(target, domains)) return true
  return provider == 'wy' && allowOfficialNavigation(target, ['graph.qq.com', 'ptlogin2.qq.com', 'open.weixin.qq.com'])
}
