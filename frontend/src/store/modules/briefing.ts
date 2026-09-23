import { defineStore } from 'pinia'
import type { BriefingFilter } from '@/types/briefing'
import { rangeFromEnd } from '@/utils/date'
import { MOCK_TODAY } from '@/mock/briefing'

export interface SavedView {
  id: string
  name: string
  filter: BriefingFilter
  createdAt: string
}

const VIEWS_KEY = 'briefing:saved-views'
const LAST_KEY = 'briefing:last-filter'

const MAX_VIEWS = 20

// 默认近 7 天，锚定到数据基准日（后端就绪后改为 new Date() 即可）
function defaultFilter(): BriefingFilter {
  const { startDate, endDate } = rangeFromEnd(MOCK_TODAY, 7)
  return { startDate, endDate, block: '', wellType: '', alarmLevel: '' }
}

/** 简单校验持久化内容，损坏时安全回退默认值 */
function isValidFilter(f: unknown): f is BriefingFilter {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  return typeof o.startDate === 'string' && typeof o.endDate === 'string'
}

function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is SavedView =>
        v && typeof v.id === 'string' && typeof v.name === 'string' && isValidFilter(v.filter)
    )
  } catch {
    return []
  }
}

function loadLastFilter(): BriefingFilter {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidFilter(parsed)) return { ...defaultFilter(), ...parsed }
    }
  } catch {
    /* 忽略损坏的缓存 */
  }
  return defaultFilter()
}

interface BriefingViewState {
  savedViews: SavedView[]
  lastFilter: BriefingFilter
}

export const useBriefingStore = defineStore('briefingView', {
  state: (): BriefingViewState => ({
    savedViews: loadViews(),
    lastFilter: loadLastFilter()
  }),

  actions: {
    persistViews() {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(this.savedViews))
    },
    persistLastFilter() {
      localStorage.setItem(LAST_KEY, JSON.stringify(this.lastFilter))
    },
    /** 记录最近一次使用的筛选，重新进入时恢复 */
    saveLastFilter(filter: BriefingFilter) {
      this.lastFilter = { ...filter }
      this.persistLastFilter()
    },
    /** 保存一组筛选视图 */
    saveView(name: string, filter: BriefingFilter): SavedView {
      const view: SavedView = {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        filter: { ...filter },
        createdAt: new Date().toISOString()
      }
      this.savedViews = [view, ...this.savedViews].slice(0, MAX_VIEWS)
      this.persistViews()
      return view
    },
    applyView(id: string): BriefingFilter | null {
      const view = this.savedViews.find((v) => v.id === id)
      if (!view) return null
      this.lastFilter = { ...view.filter }
      this.persistLastFilter()
      return this.lastFilter
    },
    deleteView(id: string) {
      this.savedViews = this.savedViews.filter((v) => v.id !== id)
      this.persistViews()
    },
    renameView(id: string, name: string) {
      const view = this.savedViews.find((v) => v.id === id)
      if (view) {
        view.name = name.trim()
        this.persistViews()
      }
    },
    resetFilter(): BriefingFilter {
      this.lastFilter = defaultFilter()
      this.persistLastFilter()
      return this.lastFilter
    }
  }
})
