<template>
  <div :class="$style.view">
    <!-- 弹窗 teleport 到 #view，必须与路由节点分层，避免离场时删除新页面使用的插入锚点。 -->
    <div :class="$style.pages">
      <router-view v-slot="{ Component, route }">
        <transition name="q-route">
          <!-- 筛选和翻页复用页面，避免新旧实例同时请求、取消请求和修改路由。 -->
          <component :is="Component" :key="['Search', 'Leaderboard', 'SongList', 'SongListDetail'].includes(route.name) ? route.path : route.fullPath" class="view-container" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.view {
  position: relative;
  z-index: 1;
}
.pages {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  > :global(.view-container) {
    position: absolute !important;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
  }
}

// 页面绝对定位叠放，新旧页面交叉淡入；离场页面不再响应点击，避免快速切换时误触。
:global(.view-container.q-route-enter-active) {
  transition: opacity .26s ease, transform .32s cubic-bezier(.22, 1, .36, 1);
}
:global(.view-container.q-route-leave-active) {
  transition: opacity .16s ease;
  pointer-events: none;
}
:global(.view-container.q-route-enter-from) {
  opacity: 0;
  transform: translateY(8px);
}
:global(.view-container.q-route-leave-to) {
  opacity: 0;
}

</style>
