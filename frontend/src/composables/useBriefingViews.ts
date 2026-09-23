import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ReportFilters } from '@/api/operations'

/**
 * 运营简报筛选视图：保存一组命名筛选 + 最近一次视图恢复。
 * 存储在浏览器 localStorage，重新进入页面自动恢复最近视图。
 */

export interface SavedView {
  id: string
  name: string
  filters: ReportFilters
  savedAt: string
}

const VIEWS_KEY = 'briefing:saved-views:v1'
const LAST_KEY = 'briefing:last-view:v1'
const MAX_VIEWS = 20

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function loadViews(): SavedView[] {
  return safeParse<SavedView[]>(localStorage.getItem(VIEWS_KEY)) || []
}

export function useBriefingViews() {
  const savedViews = ref<SavedView[]>(loadViews())

  const persist = () => {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(savedViews.value))
  }

  const saveView = (name: string, filters: ReportFilters): boolean => {
    const trimmed = name.trim()
    if (!trimmed) {
      ElMessage.warning('请输入视图名称')
      return false
    }
    if (savedViews.value.some(v => v.name === trimmed)) {
      ElMessage.warning('已存在同名视图，请换一个名称')
      return false
    }
    if (savedViews.value.length >= MAX_VIEWS) {
      ElMessage.warning(`最多保存 ${MAX_VIEWS} 个视图，请先删除不用的视图`)
      return false
    }
    savedViews.value.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      filters: JSON.parse(JSON.stringify(filters)),
      savedAt: new Date().toLocaleString('zh-CN', { hour12: false })
    })
    persist()
    ElMessage.success(`视图「${trimmed}」已保存`)
    return true
  }

  const deleteView = (id: string) => {
    savedViews.value = savedViews.value.filter(v => v.id !== id)
    persist()
    ElMessage.success('视图已删除')
  }

  /** 保存"最近使用的视图"（含匿名筛选状态），重新进入时恢复 */
  const rememberLast = (filters: ReportFilters) => {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(filters))
    } catch {
      /* 存储不可用时静默降级，不影响功能 */
    }
  }

  const loadLast = (): ReportFilters | null => safeParse<ReportFilters>(localStorage.getItem(LAST_KEY))

  return { savedViews, saveView, deleteView, rememberLast, loadLast }
}
