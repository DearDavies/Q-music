import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/leaderboard/action'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'

export default () => {
  const listRef = ref<any>(null)

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.list, index)
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
  }
}
