import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import { createStyle, getIsSupportedAutoTheme } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { getThemeAppearance, type ThemeAppearance } from '@/theme/appearance'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'

const isSupportedAutoTheme = getIsSupportedAutoTheme()

export default memo(() => {
  const t = useI18n()
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const autoByTime = useSettingValue('theme.autoByTime')
  const appearance = useSettingValue('theme.appearance')
  const themeId = useSettingValue('theme.id')
  const theme = useTheme()
  const mode = getThemeAppearance({ 'theme.appearance': appearance, 'theme.id': themeId, 'theme.autoByTime': autoByTime, 'common.isAutoTheme': isAutoTheme }, theme.isDark)
  const modes: ThemeAppearance[] = isSupportedAutoTheme ? ['light', 'dark', 'system', 'time'] : ['light', 'dark', 'time']

  return (
    <SubTitle title={t('theme_appearance')}>
      <View style={styles.content}>
        {modes.map(item => <Button
          key={item}
          accessibilityRole="radio"
          accessibilityLabel={t(`theme_appearance_${item}`)}
          accessibilityState={{ checked: mode == item }}
          style={styles.option}
          onPress={() => { updateSetting({ 'theme.appearance': item, 'theme.autoByTime': false, 'common.isAutoTheme': false }) }}
        >
          <View style={[styles.preview, { borderColor: mode == item ? theme['q-accent'] : theme['q-outline'], backgroundColor: item == 'dark' ? '#25272d' : '#f4f5f7' }]}>
            {item == 'system' || item == 'time' ? <View style={styles.darkHalf} /> : null}
            <View style={styles.previewSidebar}><View style={styles.bar} /><View style={styles.bar} /><View style={styles.bar} /></View>
            <View style={styles.previewLines}><View style={styles.bar} /><View style={[styles.bar, { width: '65%', backgroundColor: theme['q-accent'] }]} /><View style={styles.bar} /></View>
            {mode == item ? <View style={[styles.dot, { backgroundColor: theme['q-accent'], borderColor: theme['c-content-background'] }]} /> : null}
          </View>
          <Text size={12} color={mode == item ? theme['q-text-primary'] : theme['q-text-secondary']} style={styles.label}>{t(`theme_appearance_${item}`)}</Text>
        </Button>)}
      </View>
      <Text size={12} color={theme['q-text-secondary']} style={styles.tip}>{t(mode == 'time' ? 'theme_appearance_time_tip' : 'theme_appearance_tip')}</Text>
    </SubTitle>
  )
})

const styles = createStyle({
  content: {
    flexDirection: 'row',
    gap: 10,
    maxWidth: 520,
  },
  option: { flex: 1, minWidth: 0, maxWidth: 120, minHeight: 82, borderRadius: 10 },
  preview: { height: 52, borderRadius: 9, borderWidth: 2, padding: 9, flexDirection: 'row', gap: 7, overflow: 'hidden' },
  darkHalf: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', backgroundColor: '#25272d' },
  previewSidebar: { width: 12, gap: 5, paddingRight: 3 },
  previewLines: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: '#a3a8b2' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, right: 4, bottom: 4 },
  label: { textAlign: 'center', marginTop: 9, lineHeight: 18 },
  tip: { marginTop: 13, lineHeight: 19 },
})
