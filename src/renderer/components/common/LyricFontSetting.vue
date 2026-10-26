<template>
  <div :class="[$style.container, { [$style.compact]: compact }]">
    <label :class="$style.label">
      <span>{{ $t('lyric_font_title') }}</span>
      <select :aria-label="$t('lyric_font_title')" :value="appSetting['playDetail.style.font']" @change="selectFont">
        <option value="">{{ $t('lyric_font_default') }}</option>
        <option v-for="font in fonts" :key="font" :value="font">{{ font.replace(/(^\"|\"$)/g, '') }}</option>
      </select>
    </label>
    <div :class="$style.preview" :style="{ fontFamily: appSetting['playDetail.style.font'] || undefined }">
      <span>{{ $t('lyric_font_preview') }}</span>
      <small>Stay with the music</small>
    </div>
    <p v-if="!compact" :class="$style.hint">{{ $t('lyric_font_hint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from '@common/utils/vueTools'
import { getSystemFonts } from '@renderer/utils/ipc'
import { appSetting, updateSetting } from '@renderer/store/setting'

defineProps<{ compact?: boolean }>()
const systemFonts = ref<string[]>([])
// 加载系统字体之前也显示已保存的选择，避免启动时出现空白选项。
const fonts = computed(() => [...new Set([appSetting['playDetail.style.font'], ...systemFonts.value].filter(Boolean))])
onMounted(async() => {
  const installed = await getSystemFonts()
  // 备份中使用的字体可能尚未安装，仍保留选项；实际显示由系统回退。
  systemFonts.value = installed
})
const selectFont = (event: Event) => {
  updateSetting({ 'playDetail.style.font': (event.target as HTMLSelectElement).value })
}
</script>

<style lang="less" module>
.container { width: 100%; max-width: 400px; }
.label {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
  select {
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--q-outline);
    border-radius: 7px;
    color: var(--color-font);
    background: var(--color-content-background);
    font: inherit;
    cursor: pointer;
    &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  }
}
.preview {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 16px 0 8px;
  overflow-wrap: anywhere;
  font-size: 23px;
  line-height: 1.5;
  small { font-size: 14px; color: var(--color-font-label); }
}
.hint { margin-top: 8px; font-size: 12px; line-height: 1.65; color: var(--color-font-label); }
.compact {
  width: 240px;
  max-width: calc(100vw - 52px);
  padding: 12px;
  .label { font-size: 12px; gap: 8px; }
  .preview { font-size: 18px; padding-top: 10px; padding-bottom: 0; }
}
</style>
