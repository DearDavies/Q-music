import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle, getIsSupportedAutoTheme } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import themeState from '@/store/theme/state'
import Text from '@/components/common/Text'

const isSupportedAutoTheme = getIsSupportedAutoTheme()

export default memo(() => {
  const t = useI18n()
  const isAutoTheme = useSettingValue('common.isAutoTheme')
  const autoByTime = useSettingValue('theme.autoByTime')
  const setIsAutoTheme = (isAutoTheme: boolean) => {
    updateSetting({ 'common.isAutoTheme': isAutoTheme, 'theme.autoByTime': false })
  }


  return (
    <View style={styles.content}>
      {isSupportedAutoTheme ? <CheckBoxItem check={isAutoTheme} label={t('setting_basic_theme_auto_theme')} onChange={setIsAutoTheme} /> : null}
      <CheckBoxItem check={autoByTime} label={t('setting_theme_time')} onChange={enabled => {
        updateSetting({ 'theme.autoByTime': enabled, 'common.isAutoTheme': false, ...(enabled && !themeState.theme.isDark ? { 'theme.lightId': themeState.theme.id } : {}) })
      }} />
      <Text size={12} style={{ marginTop: 6 }}>{t('setting_theme_time_tip')}</Text>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
    // marginBottom: 5,
  },
})
