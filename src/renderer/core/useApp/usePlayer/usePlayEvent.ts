import { onBeforeUnmount } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { musicInfo, playMusicInfo, isPlayPending } from '@renderer/store/player/state'
import { setStop, isEmpty } from '@renderer/plugins/player'
import { retryMusicUrl, handlePlaybackFailure } from '@renderer/core/player'
import { playbackRecovery } from '@renderer/core/player/recovery'
import { setAllStatus } from '@renderer/store/player/action'

export default () => {
  const t = useI18n()
  let retries = 0
  let loadingTimeout: NodeJS.Timeout | null = null
  const startLoadingTimeout = () => {
    // console.log('start load timeout')
    clearLoadingTimeout()
    const token = playbackRecovery.token()
    loadingTimeout = setTimeout(() => {
      if (window.lx.isPlayedStop || !playbackRecovery.isCurrent(token)) return
      if (!isEmpty()) setStop()
      if (playMusicInfo.musicInfo && retries++ < 2) retryMusicUrl(playMusicInfo.musicInfo)
      else handlePlaybackFailure()
    }, 25000)
  }
  const clearLoadingTimeout = () => {
    if (!loadingTimeout) return
    // console.log('clear load timeout')
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  const handleLoadstart = () => {
    if (window.lx.isPlayedStop || playbackRecovery.isCancelled()) return
    isPlayPending.value = true
    // 关闭失败跳歌也必须结束无响应的加载，最终由 handlePlaybackFailure 决定停留或跳过。
    startLoadingTimeout()
    setAllStatus(t('player__loading'))
  }

  const handleLoadeddata = () => {
    if (playbackRecovery.isCancelled()) return
    setAllStatus(t('player__loading'))
  }

  const handlePlaying = () => {
    if (playbackRecovery.isCancelled()) return
    isPlayPending.value = false
    playbackRecovery.resetFailures()
    setAllStatus('')
    clearLoadingTimeout()
  }

  const handleEmpied = () => {
    clearLoadingTimeout()
  }

  const handleWating = () => {
    if (playbackRecovery.isCancelled()) return
    isPlayPending.value = true
    startLoadingTimeout()
    setAllStatus(t('player__buffering'))
  }

  const handleError = (errCode?: number) => {
    if (!musicInfo.id) return
    clearLoadingTimeout()
    if (window.lx.isPlayedStop || playbackRecovery.isCancelled()) return
    if (!isEmpty()) setStop()
    if (errCode === 1) { handlePlaybackFailure(); return }
    if (playMusicInfo.musicInfo && errCode !== 1 && retries++ < 2) {
      retryMusicUrl(playMusicInfo.musicInfo)
      setAllStatus(t('player__refresh_url'))
      return
    }

    handlePlaybackFailure()
  }

  const handleSetPlayInfo = () => {
    retries = 0
    clearLoadingTimeout()
  }

  // const handlePlayedStop = () => {
  //   clearDelayNextTimeout()
  //   clearLoadingTimeout()
  // }


  window.app_event.on('playerLoadstart', handleLoadstart)
  window.app_event.on('playerLoadeddata', handleLoadeddata)
  window.app_event.on('playerPlaying', handlePlaying)
  window.app_event.on('playerWaiting', handleWating)
  window.app_event.on('playerEmptied', handleEmpied)
  window.app_event.on('playerPause', clearLoadingTimeout)
  window.app_event.on('playerError', handleError)
  window.app_event.on('musicToggled', handleSetPlayInfo)

  onBeforeUnmount(() => {
    window.app_event.off('playerLoadstart', handleLoadstart)
    window.app_event.off('playerLoadeddata', handleLoadeddata)
    window.app_event.off('playerPlaying', handlePlaying)
    window.app_event.off('playerWaiting', handleWating)
    window.app_event.off('playerEmptied', handleEmpied)
    window.app_event.off('playerPause', clearLoadingTimeout)
    window.app_event.off('playerError', handleError)
    window.app_event.off('musicToggled', handleSetPlayInfo)
  })
}
