import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/leaderboard/action'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'

export default () => {
  const listRef = ref<any>(null)
  const queueLoading = ref(false)
  const queueError = ref(false)
  let playRequestId = 0

  const handlePlayList = async(index: number, fromStart = false) => {
    if (!listDetailInfo.id || !listDetailInfo.list[index]) return
    const requestId = ++playRequestId
    queueLoading.value = true
    queueError.value = false
    try {
      await playSongListDetail(listDetailInfo.id, fromStart ? undefined : [...listDetailInfo.list], fromStart ? 0 : index)
    } catch {
      if (requestId == playRequestId) queueError.value = true
    } finally {
      if (requestId == playRequestId) queueLoading.value = false
    }
  }

  let requestId = 0
  const getList = (id: string, page: number, refresh = false) => {
    const current = ++requestId
    void getAndSetListDetail(id, page, refresh).then(() => {
      setTimeout(() => {
        if (current != requestId) return
        listRef.value?.scrollToTop?.()
      })
    }).catch(() => {})
  }

  return {
    listRef,
    listDetailInfo,
    getList,
    handlePlayList,
    queueLoading,
    queueError,
  }
}
