/**
 * 简报 / 驾驶舱共用的统计口径引擎。
 *
 * 所有汇总均由该模块的纯函数计算，驾驶舱图表与运营简报复用同一函数，
 * 因此两者数字必然一致。后端真实接口与模拟回退实现也共用本模块。
 */
import type {
  AbnormalReason,
  AbnormalWell,
  AlarmChanges,
  AlarmRecord,
  BriefingFilter,
  ProductionPoint,
  ProductionRecord,
  ProductionSummary,
  WellOverview,
  WellRecord
} from '@/types/briefing'
import { daySpan, formatDate, parseDate, previousRange, shortLabel } from '@/utils/date'

/** 驾驶舱饼图固定展示顺序与配色键名 */
export const STATUS_ORDER = ['生产中', '钻井中', '待修井', '关停井'] as const

/** 产量环比下滑被视为异常的阈值（30%） */
export const PRODUCTION_DROP_THRESHOLD = -0.3

export function matchWell(well: WellRecord, filter: BriefingFilter): boolean {
  if (filter.block && well.blockName !== filter.block) return false
  if (filter.wellType && well.wellType !== filter.wellType) return false
  return true
}

export function filterWells(wells: WellRecord[], filter: BriefingFilter): WellRecord[] {
  return wells.filter((w) => matchWell(w, filter))
}

function matchAlarm(alarm: AlarmRecord, filter: BriefingFilter): boolean {
  if (filter.block && alarm.blockName !== filter.block) return false
  if (filter.alarmLevel && alarm.level !== filter.alarmLevel) return false
  return true
}

export function filterAlarms(alarms: AlarmRecord[], filter: BriefingFilter): AlarmRecord[] {
  const start = filter.startDate
  const end = filter.endDate
  return alarms.filter((a) => {
    const day = a.time.slice(0, 10)
    return day >= start && day <= end && matchAlarm(a, filter)
  })
}

export function filterProduction(
  production: ProductionRecord[],
  wellIdSet: Set<number>,
  startDate: string,
  endDate: string
): ProductionRecord[] {
  return production.filter(
    (p) => p.date >= startDate && p.date <= endDate && wellIdSet.has(p.wellId)
  )
}

/** 井状态总览：总井数 / 钻井中 / 生产中 / 未处理告警 / 状态分布 */
export function aggregateOverview(wells: WellRecord[], openAlarms: AlarmRecord[]): WellOverview {
  const distribution = STATUS_ORDER.map((name) => ({
    name,
    value: wells.filter((w) => w.status === name).length
  }))
  return {
    wellCount: wells.length,
    drillingCount: distribution[1].value,
    productionCount: distribution[0].value,
    alarmCount: openAlarms.length,
    statusDistribution: distribution,
    maintenanceCount: distribution[2].value,
    shutdownCount: distribution[3].value,
    openAlarms: [...openAlarms].sort((a, b) => (a.time < b.time ? 1 : -1))
  }
}

/** 筛选范围内未处理告警（井筛选通过 wellIds 限定） */
export function openAlarmsWithin(
  alarms: AlarmRecord[],
  wellIds: Set<number>,
  filter: BriefingFilter
): AlarmRecord[] {
  return alarms.filter(
    (a) => a.status === '未处理' && wellIds.has(a.wellId) && matchAlarm(a, filter)
  )
}

function countByLevel(alarms: AlarmRecord[]) {
  return {
    severeCount: alarms.filter((a) => a.level === '严重').length,
    warningCount: alarms.filter((a) => a.level === '警告').length,
    infoCount: alarms.filter((a) => a.level === '提示').length
  }
}

/** 告警变化：本期 / 等长上周期对比 */
export function aggregateAlarmChanges(
  allAlarms: AlarmRecord[],
  wellIds: Set<number>,
  filter: BriefingFilter
): AlarmChanges {
  const inScope = allAlarms.filter(
    (a) => wellIds.has(a.wellId) && (!filter.block || a.blockName === filter.block)
  )

  const current = inScope.filter((a) => {
    const day = a.time.slice(0, 10)
    return day >= filter.startDate && day <= filter.endDate
  })
  const prev = previousRange(filter.startDate, filter.endDate)
  const previous = inScope.filter((a) => {
    const day = a.time.slice(0, 10)
    return day >= prev.startDate && day <= prev.endDate
  })

  const levelFilter = (a: AlarmRecord) => !filter.alarmLevel || a.level === filter.alarmLevel
  const currentFiltered = current.filter(levelFilter)
  const previousFiltered = previous.filter(levelFilter)

  const unresolved = currentFiltered.filter((a) => a.status === '未处理')
  const resolved = currentFiltered.filter((a) => a.status === '已处理')

  return {
    totalInRange: currentFiltered.length,
    unresolvedInRange: unresolved.length,
    resolvedInRange: resolved.length,
    unresolvedDelta:
      unresolved.length - previousFiltered.filter((a) => a.status === '未处理').length,
    totalDelta: currentFiltered.length - previousFiltered.length,
    ...countByLevel(currentFiltered),
    alarms: [...currentFiltered].sort((a, b) => (a.time < b.time ? 1 : -1))
  }
}

function sumByDay(records: ProductionRecord[], startDate: string, endDate: string): ProductionPoint[] {
  const span = daySpan(startDate, endDate)
  const oilMap = new Map<string, number>()
  const waterMap = new Map<string, number>()
  records.forEach((r) => {
    oilMap.set(r.date, (oilMap.get(r.date) || 0) + r.oil)
    waterMap.set(r.date, (waterMap.get(r.date) || 0) + r.water)
  })
  const base = parseDate(startDate)
  const points: ProductionPoint[] = []
  for (let i = 0; i < span; i++) {
    const date = formatDate(new Date(base.getTime() + i * 86400000))
    points.push({
      date,
      oil: Math.round((oilMap.get(date) || 0) * 10) / 10,
      water: Math.round((waterMap.get(date) || 0) * 10) / 10
    })
  }
  return points
}

const round1 = (n: number) => Math.round(n * 10) / 10
const sumSeries = (points: ProductionPoint[], key: 'oil' | 'water') =>
  points.reduce((acc, p) => acc + p[key], 0)
const rate = (cur: number, prev: number) => (prev === 0 ? null : round1((cur - prev) / prev))

/** 产量汇总：本期与等长上周期的总量、日均与环比 */
export function aggregateProduction(
  production: ProductionRecord[],
  wellIds: Set<number>,
  filter: BriefingFilter
): ProductionSummary {
  const currentRecords = filterProduction(production, wellIds, filter.startDate, filter.endDate)
  const series = sumByDay(currentRecords, filter.startDate, filter.endDate)
  const prev = previousRange(filter.startDate, filter.endDate)
  const prevRecords = filterProduction(production, wellIds, prev.startDate, prev.endDate)
  const prevSeries = sumByDay(prevRecords, prev.startDate, prev.endDate)

  const totalOil = round1(sumSeries(series, 'oil'))
  const totalWater = round1(sumSeries(series, 'water'))
  const prevTotalOil = round1(sumSeries(prevSeries, 'oil'))
  const prevTotalWater = round1(sumSeries(prevSeries, 'water'))
  const span = series.length || 1

  return {
    series: series.map((p) => ({ ...p, date: shortLabel(p.date) })),
    totalOil,
    totalWater,
    avgDailyOil: round1(totalOil / span),
    avgDailyWater: round1(totalWater / span),
    prevTotalOil,
    prevTotalWater,
    oilChangeRate: rate(totalOil, prevTotalOil),
    waterChangeRate: rate(totalWater, prevTotalWater)
  }
}

/** 单井两期产量汇总 */
function wellTotals(production: ProductionRecord[], wellId: number, start: string, end: string) {
  let total = 0
  for (const r of production) {
    if (r.wellId === wellId && r.date >= start && r.date <= end) total += r.oil
  }
  return round1(total)
}

export interface MonthlyPoint {
  month: string
  oil: number
  water: number
}

/**
 * 驾驶舱产量趋势口径：按「月」汇总全部井的产油 / 产水总量。
 * 与简报的按日趋势共用同一份产量记录，仅聚合粒度不同。
 * 仅保留截至数据基准日（endDate）的完整月份，避免把未来零值日期算成月份。
 */
export function aggregateMonthlyProduction(
  production: ProductionRecord[],
  wellIds: Set<number>,
  endDate = '9999-12-31',
  lastNMonths = 7
): MonthlyPoint[] {
  const maxMonth = endDate.slice(0, 7)
  const map = new Map<string, { oil: number; water: number }>()
  production.forEach((r) => {
    if (!wellIds.has(r.wellId)) return
    const month = r.date.slice(0, 7)
    if (month > maxMonth) return
    const cur = map.get(month) || { oil: 0, water: 0 }
    cur.oil += r.oil
    cur.water += r.water
    map.set(month, cur)
  })
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-lastNMonths)
    .map(([month, v]) => ({
      month: `${Number(month.slice(5))}月`,
      oil: Math.round(v.oil * 10) / 10,
      water: Math.round(v.water * 10) / 10
    }))
}

/**
 * 异常井清单，命中任一条件即纳入：
 *  1. 有严重未处理告警
 *  2. 状态为待修井 / 关停井
 *  3. 生产井本周期产油环比下滑超过 30%
 */
export function aggregateAbnormalWells(
  wells: WellRecord[],
  production: ProductionRecord[],
  alarms: AlarmRecord[],
  filter: BriefingFilter
): AbnormalWell[] {
  const prev = previousRange(filter.startDate, filter.endDate)
  const result: AbnormalWell[] = []

  wells.forEach((well) => {
    const reasons: AbnormalReason[] = []
    const wellAlarms = alarms.filter(
      (a) =>
        a.wellId === well.id &&
        a.status === '未处理' &&
        a.level === '严重' &&
        (!filter.alarmLevel || a.level === filter.alarmLevel)
    )
    if (wellAlarms.length > 0) reasons.push('严重告警未处理')
    if (well.status === '待修井') reasons.push('待修井')
    if (well.status === '关停井') reasons.push('关停井')

    const currentOil = wellTotals(production, well.id, filter.startDate, filter.endDate)
    const previousOil = wellTotals(production, well.id, prev.startDate, prev.endDate)
    const changeRate = previousOil === 0 ? null : round1((currentOil - previousOil) / previousOil)
    if (
      well.status === '生产中' &&
      changeRate !== null &&
      changeRate <= PRODUCTION_DROP_THRESHOLD
    ) {
      reasons.push('产量环比下滑超阈值')
    }

    if (reasons.length === 0) return
    result.push({
      wellId: well.id,
      wellName: well.wellName,
      blockName: well.blockName,
      status: well.status,
      reasons,
      currentOil,
      previousOil,
      changeRate,
      unresolvedSerious: wellAlarms.length
    })
  })

  // 严重告警优先，其次产量下滑幅度
  return result.sort((a, b) => {
    if (b.unresolvedSerious !== a.unresolvedSerious) return b.unresolvedSerious - a.unresolvedSerious
    const ad = a.changeRate ?? 0
    const bd = b.changeRate ?? 0
    return ad - bd
  })
}
