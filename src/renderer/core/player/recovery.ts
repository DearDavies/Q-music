// 区分用户取消与播放器内部的暂停/缓冲；旧异步任务不能重新启动播放。
export const createPlaybackRecovery = () => {
  let revision = 0
  let cancelled = false
  const failedTracks = new Set<string>()
  return {
    begin: () => { cancelled = false; return ++revision },
    cancel: () => { cancelled = true; ++revision },
    token: () => revision,
    isCancelled: () => cancelled,
    isCurrent: (token: number) => !cancelled && token == revision,
    resetFailures: () => { failedTracks.clear() },
    canSkip: (track: string) => {
      if (failedTracks.has(track)) return false
      failedTracks.add(track)
      return failedTracks.size < 3
    },
  }
}

export const playbackRecovery = createPlaybackRecovery()
