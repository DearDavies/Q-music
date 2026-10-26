import { memo, useEffect, useRef, useState } from 'react'
import { View, FlatList, type NativeScrollEvent, type NativeSyntheticEvent, type FlatListProps } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'

import { useTheme } from '@/store/theme/hook'
import { useActiveListId, useListFetching, useMyList } from '@/store/list/hook'
import { createStyle, toast } from '@/utils/tools'
import { LIST_SCROLL_POSITION_KEY } from '@/config/constant'
import { getListPosition, saveListPosition } from '@/utils/data'
import { setActiveList, updateUserListPosition } from '@/core/list'
import listState from '@/store/list/state'
import { userListsUpdatePosition } from '@/utils/listManage'
import { useI18n } from '@/lang'
import PlaylistIdentity, { getPlaylistLabel } from '@/components/PlaylistIdentity'
import { type Position } from './ListMenu'
import { scaleSizeH } from '@/utils/pixelRatio'
import Loading from '@/components/common/Loading'
import Button, { type BtnType } from '@/components/common/Button'
import { useDockInset } from '@/components/common/DockInset'

type FlatListType = FlatListProps<LX.List.MyListInfo>

const ITEM_HEIGHT = scaleSizeH(62)

const ListItem = memo(({ item, index, activeId, onPress, onShowMenu, sorting, moving, canMoveUp, canMoveDown, onMove }: {
  sorting: boolean
  moving: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (id: string, direction: -1 | 1) => void
  onPress: (item: LX.List.MyListInfo) => void
  index: number
  activeId: string
  item: LX.List.MyListInfo
  onShowMenu: (item: LX.List.MyListInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const moreButtonRef = useRef<BtnType>(null)
  const fetching = useListFetching(item.id)

  const active = activeId == item.id

  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }

  const handlePress = () => {
    onPress(item)
  }

  return (
    <View style={{ ...styles.listItem, height: ITEM_HEIGHT, backgroundColor: active ? theme['q-surface-tint'] : 'transparent', borderRadius: 14, marginHorizontal: 8 }}>
      {active ? <View style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 2, backgroundColor: theme['q-accent'] }} /> : null}
      <Button
        accessibilityLabel={getPlaylistLabel(item)}
        accessibilityState={{ selected: active }}
        style={styles.listName}
        disabled={sorting}
        onPress={handlePress}
      >
        <PlaylistIdentity list={item} subtitle={'source' in item} active={active} />
      </Button>
      {fetching ? <Loading color={theme['q-accent-text']} style={styles.loading} /> : null}
      {sorting ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {index < 2 ? <Text size={11} color={theme['q-text-secondary']} style={{ width: 88, textAlign: 'center' }}>{t('playlist_order_fixed')}</Text> : ([{ direction: -1, enabled: canMoveUp, icon: 'chevron-up', label: 'playlist_order_up' },
          { direction: 1, enabled: canMoveDown, icon: 'chevron-down', label: 'playlist_order_down' }] as const).map(control => (
          <Button key={control.direction} accessibilityLabel={`${t(control.label)} ${getPlaylistLabel(item)}`} disabled={!control.enabled || moving}
            onPress={() => { onMove(item.id, control.direction) }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: control.enabled && !moving ? 1 : 0.25 }}>
            <Icon name={control.icon} size={19} color={theme['q-accent-text']} />
          </Button>
        ))}
      </View> : <Button
        accessibilityLabel={`${getPlaylistLabel(item)} menu`}
        accessibilityHint="Show list actions"
        onPress={handleShowMenu}
        ref={moreButtonRef}
        style={styles.listMoreBtn}
      >
        <Icon accessible={false} name="dots-vertical" color={theme['c-350']} size={17} />
      </Button>}
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.sorting === nextProps.sorting && prevProps.moving === nextProps.moving &&
    prevProps.canMoveUp === nextProps.canMoveUp && prevProps.canMoveDown === nextProps.canMoveDown &&
    prevProps.index === nextProps.index &&
    prevProps.item.name == nextProps.item.name &&
    prevProps.activeId != nextProps.item.id &&
    nextProps.activeId != nextProps.item.id
  )
})


export default ({ onShowMenu, sorting = false }: {
  sorting?: boolean
  onShowMenu: (info: { listInfo: LX.List.MyListInfo, index: number }, position: Position) => void
}) => {
  const flatListRef = useRef<FlatList>(null)
  const dockInset = useDockInset()
  const allList = useMyList()
  const activeListId = useActiveListId()
  const t = useI18n()
  const [moving, setMoving] = useState(false)
  const movingRef = useRef(false)

  const moveList = (id: string, direction: -1 | 1) => {
    const index = listState.userList.findIndex(item => item.id == id)
    const next = index + direction
    if (movingRef.current || index < 0 || next < 0 || next >= listState.userList.length) return
    movingRef.current = true
    setMoving(true)
    void updateUserListPosition(next, [id]).catch(() => {
      // 保存失败恢复当前顺序；固定列表不在 userList 中，不会被移动。
      userListsUpdatePosition(index, [id])
      toast(t('playlist_order_failed'), 'long')
    }).finally(() => {
      movingRef.current = false
      setMoving(false)
    })
  }

  const handleToggleList = (item: LX.List.MyListInfo) => {
    // setVisiblePanel(false)
    global.app_event.changeLoveListVisible(false)
    requestAnimationFrame(() => {
      setActiveList(item.id)
    })
  }


  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    void saveListPosition(LIST_SCROLL_POSITION_KEY, nativeEvent.contentOffset.y)
  }

  const showMenu = (listInfo: LX.List.MyListInfo, index: number, position: Position) => {
    onShowMenu({ listInfo, index }, position)
  }

  useEffect(() => {
    void getListPosition(LIST_SCROLL_POSITION_KEY).then((offset) => {
      flatListRef.current?.scrollToOffset({ offset, animated: false })
    })
  }, [])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      key={item.id}
      item={item}
      index={index}
      activeId={activeListId}
      onPress={handleToggleList}
      onShowMenu={showMenu}
      sorting={sorting}
      moving={moving}
      canMoveUp={index > 2}
      canMoveDown={index >= 2 && index < allList.length - 1}
      onMove={moveList}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: dockInset }}
      ref={flatListRef}
      onScroll={handleScroll}
      style={styles.container}
      data={allList}
      extraData={`${sorting}:${moving}:${activeListId}`}
      maxToRenderPerBatch={9}
      // updateCellsBatchingPeriod={80}
      windowSize={9}
      removeClippedSubviews={true}
      initialNumToRender={18}
      renderItem={renderItem}
      keyExtractor={getkey}
      // extraData={activeIndex}
      getItemLayout={getItemLayout}
    />
  )
}


const styles = createStyle({
  container: {
    flex: 1,
  },
  // listContainer: {
  //   // borderBottomWidth: BorderWidths.normal2,
  // },

  listItem: {
    height: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 5,
    paddingLeft: 5,
    // borderBottomWidth: BorderWidths.normal,
  },
  listActiveIcon: {
    // width: 18,
    marginLeft: 3,
    // paddingRight: 5,
    textAlign: 'center',
  },
  loading: {
    marginLeft: 5,
  },
  listName: {
    height: ITEM_HEIGHT,
    minHeight: 48,
    // height: 46,
    // paddingTop: 12,
    // paddingBottom: 12,
    justifyContent: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // listNameText: {
  //   // height: 46,
  //   fontSize: 14,
  // },
  listMoreBtn: {
    height: ITEM_HEIGHT,
    minHeight: 48,
    width: 48,
    minWidth: 48,
    // height: 46,
    // paddingTop: 12,
    // paddingBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})

