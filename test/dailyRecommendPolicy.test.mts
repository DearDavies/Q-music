import test from 'node:test'
import assert from 'node:assert/strict'
import { getDailyRefreshAction } from '../src/common/utils/dailyRecommendPolicy.ts'

test('加载中和平台个性化推荐不提供虚假的换一批', () => {
  for (const mode of ['loading', 'personalized']) {
    for (const reason of ['', 'login_required', 'unavailable']) assert.equal(getDailyRefreshAction(mode, reason), undefined)
  }
})

test('本地混合可换一批，平台或歌曲详情失败时可以重试', () => {
  assert.equal(getDailyRefreshAction('fallback', ''), 'shuffle')
  assert.equal(getDailyRefreshAction('fallback', 'login_required'), 'shuffle')
  assert.equal(getDailyRefreshAction('fallback', 'unavailable'), 'retry')
})
