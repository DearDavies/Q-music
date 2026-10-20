<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ info.name }}<br>{{ info.singer }}</h2>
      <p v-if="!qualitys.length" :class="$style.message">{{ $t('player_download_unavailable') }}</p>
      <p v-if="error" role="status" :class="$style.message">{{ $t('player_download_failed') }}</p>
      <base-btn v-for="quality in qualitys" :key="quality.type" :disabled="working" :class="$style.btn" @click="handleClick(quality.type)">
        {{ getTypeName(quality.type) }}{{ quality.size && ` - ${quality.size.toUpperCase()}` }}
      </base-btn>
    </main>
  </material-modal>
</template>

<script>
import { qualityList } from '@renderer/store'
import { createDownloadTasks } from '@renderer/store/download/action'

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    listId: {
      type: String,
      default: '',
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show'],
  setup() {
    return {
      qualityList,
    }
  },
  data: () => ({ working: false, error: false }),
  computed: {
    info() {
      return this.musicInfo || {}
    },
    sourceQualityList() {
      return this.qualityList[this.info.source] || []
    },
    qualitys() {
      return this.info.meta?.qualitys?.filter(quality => this.checkSource(quality.type)) || []
    },
  },
  watch: { show() { this.error = false } },
  methods: {
    async handleClick(quality) {
      if (this.working) return
      this.working = true
      this.error = false
      try {
        await createDownloadTasks([this.musicInfo], quality, this.listId)
        this.$emit('update:show', false)
      } catch { this.error = true } finally { this.working = false }
    },
    handleClose() {
      if (this.working) return
      this.$emit('update:show', false)
    },
    getTypeName(quality) {
      switch (quality) {
        case 'flac24bit':
          return this.$t('download__lossless') + ' FLAC Hires'
        case 'flac':
        case 'ape':
        case 'wav':
          return this.$t('download__lossless') + ' ' + quality.toUpperCase()
        case '320k':
          return this.$t('download__high_quality') + ' ' + quality.toUpperCase()
        case '192k':
        case '128k':
          return this.$t('download__normal') + ' ' + quality.toUpperCase()
      }
    },
    checkSource(quality) {
      return this.sourceQualityList.includes(quality)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 400px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    margin-bottom: 15px;
  }
}

.btn {
  display: block;
  margin-bottom: 15px;
  &:last-child {
    margin-bottom: 0;
  }
}
.message { font-size: 13px; line-height: 1.6; margin-bottom: 14px; color: var(--color-font-label); }

</style>
