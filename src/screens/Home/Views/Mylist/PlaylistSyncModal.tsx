import { forwardRef, useImperativeHandle, useRef, useState, useSyncExternalStore, useEffect } from 'react'
import { ScrollView, StyleSheet, Switch, View } from 'react-native'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import PlaylistIdentity, { getPlaylistLabel } from '@/components/PlaylistIdentity'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { getListUpdateInfo, setListAutoUpdate } from '@/utils/data'
import { isQQSyncList, refreshQQList } from '@/core/musicAccount/autoSync'
import syncSourceList from '@/core/syncSourceList'
import { getPlaylistSyncState, subscribePlaylistSync } from '@/core/musicAccount/syncState'
import { toast } from '@/utils/tools'

export interface PlaylistSyncModalType { show: () => void }
export default forwardRef<PlaylistSyncModalType>((props, ref) => {
  const dialog = useRef<DialogType>(null)
  const theme = useTheme()
  const t = useI18n()
  const allLists = useMyList()
  const lists = allLists.filter((list): list is LX.List.UserListInfo => 'source' in list && !!list.source && !!list.sourceListId)
  const states = useSyncExternalStore(subscribePlaylistSync, getPlaylistSyncState)
  const [settings, setSettings] = useState<LX.List.ListUpdateInfo>({})
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const running = useRef(false)
  const loadSettings = async() => { setSettings({ ...await getListUpdateInfo() }) }
  useImperativeHandle(ref, () => ({ show() { setVisible(true); dialog.current?.setVisible(true); void loadSettings().catch(() => {}) } }))
  useEffect(() => { if (visible) void loadSettings().catch(() => {}) }, [states, visible])
  const update = async(list: LX.List.UserListInfo) => {
    try {
      if (list.source == 'tx') await refreshQQList(list)
      else await syncSourceList(list)
      await loadSettings()
      return true
    } catch { return false }
  }
  const syncAll = async() => {
    if (running.current) return
    running.current = true
    setBusy(true)
    const targets = lists.filter(isQQSyncList)
    let failed = 0
    try {
      for (const [index, list] of targets.entries()) {
        setResult(t('list_sync_batch_progress', { current: index + 1, total: targets.length }))
        if (!await update(list)) failed++
      }
      setResult(t('list_sync_batch_done', { current: targets.length, total: targets.length, failed }))
    } finally { running.current = false; setBusy(false) }
  }
  return <Dialog ref={dialog} title={t('list_update_modal__title')} closeBtn keyHide bgHide onHide={() => { setVisible(false) }}>
    <ScrollView contentContainerStyle={styles.content}>
      <Button disabled={busy || !lists.some(isQQSyncList)} style={[styles.batch, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { void syncAll() }}>
        <Icon name="available_updates" size={18} color={theme['q-accent-text']} /><Text size={13} color={theme['q-accent-text']}>{t(busy ? 'list_sync_working' : 'list_sync_all_qq')}</Text>
      </Button>
      {result ? <Text size={12} accessibilityLiveRegion="polite" style={styles.feedback}>{result}</Text> : null}
      {lists.map(list => {
        const state = states[list.id]
        const fetching = state?.phase == 'fetch' || state?.phase == 'save'
        return <View key={list.id} style={[styles.row, { borderColor: theme['q-outline'] }]}>
          <View style={styles.heading}><PlaylistIdentity list={list} subtitle /><Button disabled={fetching || busy} accessibilityLabel={`${t('list_update_modal__update')} ${getPlaylistLabel(list)}`} style={styles.refresh} onPress={() => { void update(list).then(ok => { if (!ok) toast(t('list_sync_failed')) }) }}><Icon name="available_updates" size={20} color={theme['q-accent-text']} /></Button></View>
          {isQQSyncList(list) ? <View style={styles.heading}><Text size={12} style={{ flex: 1 }}>{t('list_update_modal__auto_update')}</Text><Switch accessibilityLabel={`${list.name} ${t('list_update_modal__auto_update')}`} value={settings[list.id]?.isAutoUpdate} onValueChange={enable => { void setListAutoUpdate(list.id, enable).then(loadSettings).catch(() => { toast(t('list_sync_failed')) }) }} trackColor={{ true: theme['q-accent'] }} /></View> : null}
          <Text size={11} color={theme['q-text-secondary']}>{settings[list.id]?.updateTime ? new Date(settings[list.id].updateTime).toLocaleString() : t('list_sync_never')}</Text>
          {state ? <Text size={12} style={styles.feedback} accessibilityLiveRegion="polite" color={theme['q-text-secondary']}>{state.phase == 'error' ? t(state.error == 'account_changed' ? 'list_sync_account_changed' : 'list_sync_failed') : t(state.phase == 'success' ? 'list_sync_success' : state.phase == 'save' ? 'list_sync_save' : state.total ? 'list_sync_fetch' : 'list_sync_working', { current: state.current, total: state.total })}</Text> : isQQSyncList(list) && !settings[list.id]?.sourceAccountId ? <Text size={11} style={styles.feedback} color={theme['q-text-secondary']}>{t('list_sync_binding_required')}</Text> : null}
        </View>
      })}
      <Text size={12} color={theme['q-text-secondary']} style={styles.feedback}>{t('list_update_modal__tips')}</Text>
    </ScrollView>
  </Dialog>
})

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  batch: { minHeight: 46, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14, gap: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refresh: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  feedback: { lineHeight: 18 },
})
