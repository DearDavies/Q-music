import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { getImportedLyricFont, getLyricFontFamily, importLyricFont } from '@/core/lyricFont'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const font = useSettingValue('playDetail.style.font')
  const [busy, setBusy] = useState(false)
  const importing = useRef(false)
  const fileRef = useRef<FileSelectType>(null)
  const custom = getImportedLyricFont()
  const options = [
    { id: '', label: t('lyric_font_default') },
    { id: 'serif', label: t('lyric_font_serif') },
    { id: 'monospace', label: t('lyric_font_mono') },
    ...(custom ? [{ id: custom.family, label: custom.name }] : []),
  ]
  const currentFont = getLyricFontFamily(font)
  const select = () => {
    if (importing.current) return
    fileRef.current?.show({ title: t('lyric_font_import'), filter: ['ttf', 'otf'] }, path => {
      if (importing.current) return
      importing.current = true
      setBusy(true)
      void importLyricFont(path).catch((error: Error & { code?: string }) => {
        toast(t(error.code == 'font_too_large' ? 'lyric_font_too_large' : 'lyric_font_failed'), 'long')
      }).finally(() => {
        importing.current = false
        setBusy(false)
      })
    })
  }
  return <View style={styles.container}>
    <View style={styles.heading}>
      <Text size={14} style={styles.title}>{t('lyric_font_title')}</Text>
      <Button onPress={select} disabled={busy} style={[styles.importButton, { opacity: busy ? 0.5 : 1 }]}>
        <Text size={12} color={theme['q-accent-text']}>{t(busy ? 'lyric_font_importing' : 'lyric_font_import')}</Text>
      </Button>
    </View>
    <View style={styles.options}>
      {options.map(option => {
        const selected = option.id == (currentFont ?? '')
        return <Button key={option.id} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: selected }}
          accessibilityLabel={option.label} onPress={() => { updateSetting({ 'playDetail.style.font': option.id }) }}
          style={[styles.option, { backgroundColor: selected ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: selected ? theme['q-accent-text'] : theme['q-outline'] }]}>
          <Text size={12} numberOfLines={1} color={selected ? theme['q-accent-text'] : theme['q-text-primary']}>{option.label}</Text>
        </Button>
      })}
    </View>
    <Text size={22} style={[styles.preview, { fontFamily: currentFont }]}>{t('lyric_font_preview')}</Text>
    <Text size={13} color={theme['q-text-secondary']} style={{ fontFamily: currentFont }}>Stay with the music</Text>
    <Text size={11} color={theme['q-text-secondary']} style={styles.hint}>{t('lyric_font_hint')}</Text>
    <FileSelect ref={fileRef} />
  </View>
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 15, paddingVertical: 12, alignSelf: 'stretch' },
  heading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  title: { flex: 1, minWidth: 100, fontWeight: '600' },
  importButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  preview: { marginTop: 18, marginBottom: 6 },
  hint: { marginTop: 12, lineHeight: 18 },
})
