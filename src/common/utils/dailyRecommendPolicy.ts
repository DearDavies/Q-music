// 平台决定日推内容，重新请求不代表换歌；失败重试与本地换一批分开显示。
export const getDailyRefreshAction = (mode: string, reason: string): 'shuffle' | 'retry' | undefined => {
  if (mode != 'fallback') return undefined
  return !reason || reason == 'login_required' ? 'shuffle' : 'retry'
}
