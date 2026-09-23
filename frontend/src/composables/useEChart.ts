import { ref, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsInstance, ECOption } from '@/utils/charts'

/**
 * ECharts 生命周期封装：
 * - init / setOption 全程 try/catch，图表渲染失败时对外标记 renderError
 *   （供页面展示"图表不可用"占位，不影响其他区块与文字摘要）
 * - ResizeObserver 自适应；组件卸载时 dispose，避免路由切换后泄漏
 */
export function useEChart(target: Ref<HTMLElement | undefined>, optionRef: Ref<ECOption | null>) {
  let chart: EChartsInstance | null = null
  let observer: ResizeObserver | null = null
  const renderError = ref(false)

  const render = () => {
    if (!target.value || !optionRef.value) return
    renderError.value = false
    try {
      if (!chart) {
        chart = echarts.init(target.value)
        observer = new ResizeObserver(() => chart?.resize())
        observer.observe(target.value)
      }
      chart.setOption(optionRef.value, true)
    } catch (e) {
      console.error('[useEChart] 图表渲染失败:', e)
      renderError.value = true
    }
  }

  // flush: 'post' —— 配合 v-if 容器（success 时才挂载），确保回调在 DOM 更新后执行
  watch(optionRef, render, { deep: true, flush: 'post' })

  onMounted(render)

  onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.dispose()
    chart = null
  })

  return { renderError }
}
