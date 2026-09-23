import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

/**
 * 绑定 ECharts 实例：随 option 变化自动 setOption，随窗口尺寸自适应；
 * 容器可能在 v-if 内延迟挂载（如数据成功后才出现），因此用 post watcher
 * 确保 DOM 就绪后再 init；ResizeObserver 兜底容器尺寸变化。
 */
export function useChart(
  el: Ref<HTMLElement | undefined>,
  option: Ref<EChartsOption | null>,
  enabled: Ref<boolean>
) {
  let chart: echarts.ECharts | null = null
  let observer: ResizeObserver | null = null
  const ready = ref(false)

  const ensureChart = () => {
    if (!el.value) return null
    if (!chart) {
      chart = echarts.init(el.value)
      ready.value = true
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => chart?.resize())
        observer.observe(el.value)
      }
    }
    return chart
  }

  const render = () => {
    if (!enabled.value || !option.value) return
    const c = ensureChart()
    if (c) {
      c.setOption(option.value, true)
      c.resize()
    }
  }

  const resize = () => chart?.resize()

  onMounted(() => window.addEventListener('resize', resize))

  // post：等 v-if 容器真正挂载后再初始化
  watch([option, enabled], () => render(), { deep: true, flush: 'post' })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    observer?.disconnect()
    chart?.dispose()
    chart = null
  })

  return { ready }
}
