import * as echarts from 'echarts'
import type {
  TrendPoint,
  StatusCount,
  AlarmBucket,
  AbnormalWell
} from '@/api/operations'
import { STATUS_COLORS } from '@/api/operations'

/**
 * 图表 option 构造器：综合驾驶舱与运营简报共用，
 * 保证同一系列颜色、图例、轴配置（统计口径的视觉一致性）。
 */

export const SERIES_COLORS = {
  oil: '#3b82f6',
  water: '#06b6d4',
  opened: '#ef4444',
  resolved: '#22c55e'
}

export function productionTrendOption(points: TrendPoint[]) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['日产油量', '日产水量'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map(p => p.label)
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '日产油量',
        type: 'line',
        smooth: true,
        connectNulls: true,
        data: points.map(p => p.oil),
        itemStyle: { color: SERIES_COLORS.oil }
      },
      {
        name: '日产水量',
        type: 'line',
        smooth: true,
        connectNulls: true,
        data: points.map(p => p.water),
        itemStyle: { color: SERIES_COLORS.water }
      }
    ]
  }
}

export function wellStatusOption(breakdown: StatusCount[]) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 口 ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '井状态',
        type: 'pie',
        radius: '60%',
        data: breakdown.map(b => ({
          value: b.value,
          name: b.name,
          itemStyle: { color: STATUS_COLORS[b.name] }
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }
    ]
  }
}

export function alarmTrendOption(buckets: AlarmBucket[]) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增告警', '已处置'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: buckets.map(b => b.label) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '新增告警',
        type: 'bar',
        barMaxWidth: 28,
        data: buckets.map(b => b.opened),
        itemStyle: { color: SERIES_COLORS.opened, borderRadius: [3, 3, 0, 0] }
      },
      {
        name: '已处置',
        type: 'bar',
        barMaxWidth: 28,
        data: buckets.map(b => b.resolved),
        itemStyle: { color: SERIES_COLORS.resolved, borderRadius: [3, 3, 0, 0] }
      }
    ]
  }
}

export function abnormalLevelOption(items: AbnormalWell[]) {
  const countBy = (level: AbnormalWell['level']) =>
    items.filter(i => i.level === level).length
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 口 ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '异常井级别',
        type: 'pie',
        radius: ['42%', '66%'],
        data: [
          { value: countBy('严重'), name: '严重', itemStyle: { color: '#ef4444' } },
          { value: countBy('警告'), name: '警告', itemStyle: { color: '#f59e0b' } },
          { value: countBy('提示'), name: '提示', itemStyle: { color: '#94a3b8' } }
        ].filter(d => d.value > 0),
        label: { formatter: '{b}: {c} 口' }
      }
    ]
  }
}

export type ECOption =
  | ReturnType<typeof productionTrendOption>
  | ReturnType<typeof wellStatusOption>
  | ReturnType<typeof alarmTrendOption>
  | ReturnType<typeof abnormalLevelOption>

export type EChartsInstance = echarts.ECharts
