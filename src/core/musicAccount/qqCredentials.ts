// QQ 网页 Cookie 的 login_type：1 为 QQ、2 为微信；与 musicu 的 tmeLoginType 相反。
export const getQQCredentials = (cookies: Record<string, string>) => {
  const keys = [cookies.qqmusic_key, cookies.qm_keyst, cookies.musickey].filter(value => value?.trim())
  const isWeChat = cookies.login_type == '2' || (cookies.login_type != '1' && (keys.some(value => value.startsWith('W_X')) || !!cookies.wxuin))
  // 两种登录方式的 Cookie 可能同时残留，优先使用与当前登录类型一致的音乐凭证。
  const authst = isWeChat
    ? keys.find(value => value.startsWith('W_X')) ?? keys.find(value => !value.startsWith('Q_H_L')) ?? ''
    : keys.find(value => !value.startsWith('W_X')) ?? ''
  // 微信登录不能退回残留的 QQ uin，否则会把两个账号的身份与凭证混用。
  const identifiers = isWeChat
    ? [cookies.wxuin, cookies.musicid, cookies.qqmusic_uin]
    : [cookies.qqmusic_uin, cookies.uin, cookies.musicid]
  const rawUin = identifiers.find(value => /^o?\d+$/i.test(value ?? '') && !/^o?0+$/i.test(value)) ?? ''
  return {
    uin: rawUin.replace(/^o/i, '').replace(/^0+/, ''),
    authst,
    isWeChat,
    tmeLoginType: isWeChat ? 1 : 2,
  }
}

export const getQQRequestComm = (cookies: Record<string, string>, ct = 24) => {
  const { uin, authst, tmeLoginType } = getQQCredentials(cookies)
  return { uin, authst, ct, cv: 0, format: 'json', tmeAppID: 'qqmusic', tmeLoginType }
}
