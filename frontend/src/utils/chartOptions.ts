/** 驾驶舱与运营简报共用的 ECharts 配置与配色，保证视觉与口径一致 */
import type { EChartsOption } from 'echarts'
import type { ProductionPoint, StatusDistributionItem } from '@/types/briefing'

export const STATUS_COLORS: Record<string, string> = {
  生产中: '#22c55e',
  钻井中: '#3b82f6',
  待修井: '#f59e0b',
  关停井: '#ef4444'
}

export const OIL_COLOR = '#3b82f6'
export const WATER_COLOR = '#06b6d4'

/** 产量趋势（日产油 / 日产水双线），驾驶舱与简报共用同一配置结构 */
export function buildProductionTrendOption(series: ProductionPoint[]): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['日产油量', '日产水量'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: series.map((p) => p.date)
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '日产油量',
        type: 'line',
        smooth: true,
        data: series.map((p) => p.oil),
        itemStyle: { color: OIL_COLOR }
      },
      {
        name: '日产水量',
        type: 'line',
        smooth: true,
        data: series.map((p) => p.water),
        itemStyle: { color: WATER_COLOR }
      }
    ]
  }
}

/** 井状态分布饼图，数据顺序与配色全应用一致 */
export function buildWellStatusOption(distribution: StatusDistributionItem[]): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '井状态',
        type: 'pie',
        radius: '60%',
        data: distribution.map((d) => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: STATUS_COLORS[d.name] }
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }
    ]
  }
}

/** 告警级别分布（简报新增图表，复用告警色系） */
export function buildAlarmLevelOption(counts: { severeCount: number; warningCount: number; infoCount: number }): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '告警级别',
        type: 'pie',
        radius: ['40%', '65%'],
        data: [
          { value: counts.severeCount, name: '严重', itemStyle: { color: '#ef4444' } },
          { value: counts.warningCount, name: '警告', itemStyle: { color: '#f59e0b' } },
          { value: counts.infoCount, name: '提示', itemStyle: { color: '#94a3b8' } }
        ],
        label: { formatter: '{b}: {c}' }
      }
    ]
  }
}
