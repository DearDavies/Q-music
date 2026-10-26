import { isActive } from '@/utils/tools'
import { useEffect, useState } from 'react'
import state, { type InitState } from './state'

export const usePlayerMusicInfo = () => {
  const [value, update] = useState(state.musicInfo)

  useEffect(() => {
    global.state_event.on('playerMusicInfoChanged', update)
    return () => {
      global.state_event.off('playerMusicInfoChanged', update)
    }
  }, [])

  return value
}

export const usePlayMusicInfo = () => {
  const [value, update] = useState(state.playMusicInfo)

  useEffect(() => {
    global.state_event.on('playMusicInfoChanged', update)
    return () => {
      global.state_event.off('playMusicInfoChanged', update)
    }
  }, [])

  return value
}

export const usePlayInfo = () => {
  const [value, update] = useState(state.playInfo)

  useEffect(() => {
    global.state_event.on('playInfoChanged', update)
    return () => {
      global.state_event.off('playInfoChanged', update)
    }
  }, [])

  return value
}

export const useStatusText = () => {
  const [value, update] = useState(state.statusText)

  useEffect(() => {
    global.state_event.on('playStateTextChanged', update)
    return () => {
      global.state_event.off('playStateTextChanged', update)
    }
  }, [])

  return value
}

export const useIsPlay = () => {
  const [value, update] = useState(state.isPlay)

  useEffect(() => {
    global.state_event.on('playStateChanged', update)
    return () => {
      global.state_event.off('playStateChanged', update)
    }
  }, [])

  return value
}

// 控制按钮在取地址、缓冲和等待换歌时仍可取消，封面动画继续使用真实播放状态。
export const usePlayControlState = () => {
  const playing = useIsPlay()
  const [pending, update] = useState(state.isPlayPending)
  useEffect(() => {
    update(state.isPlayPending)
    global.state_event.on('playPendingChanged', update)
    return () => { global.state_event.off('playPendingChanged', update) }
  }, [])
  return playing || pending
}

export const useProgress = (autoUpdate = true) => {
  const [value, update] = useState(state.progress)

  useEffect(() => {
    if (!autoUpdate) return
    const handleUpdate = (progress: InitState['progress']) => {
      if (isActive()) update(progress)
    }
    update(state.progress)
    global.state_event.on('playProgressChanged', handleUpdate)
    return () => {
      global.state_event.off('playProgressChanged', handleUpdate)
    }
  }, [autoUpdate])

  return value
}
