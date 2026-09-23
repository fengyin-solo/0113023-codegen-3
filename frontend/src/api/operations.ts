import request from '@/utils/request'

/**
 * 运营简报 / 综合驾驶舱 统一数据层
 *
 * 所有关键指标（总井数、井状态分布、产量趋势、告警）均由本模块的同一组
 * 纯函数聚合得到，综合驾驶舱与运营简报共用，保证两处统计口径完全一致。
 *
 * 每个数据源独立请求、独立返回状态（success / empty / error），
 * 单个接口失败或无数据不影响其他区块的呈现。
 *
 * 当前环境没有可用后端，默认使用内置 mock 数据源；后端就绪后将
 * USE_MOCK 置为 false 即切换为真实接口，页面与聚合逻辑无需改动。
 */
export const USE_MOCK = true

// ---------- 类型定义 ----------

export type RangeType = '7d' | '30d' | '90d' | '180d' | 'custom'
export type SectionStatus = 'success' | 'empty' | 'error'
/** 数据可用性演示场景：正常 / 全部无数据 / 接口失败 / 部分区块失败 */
export type FailureScenario = 'normal' | 'empty' | 'error' | 'partial'

export interface SectionData<T> {
  status: SectionStatus
  data: T | null
  message?: string
  loadedAt?: string
}

export interface ReportFilters {
  rangeType: RangeType
  startDate?: string
  endDate?: string
  block: string
  alarmLevels: string[]
  wellStatuses: string[]
}

export interface Well {
  id: number
  name: string
  block: string
  status: WellStatus
}

export type WellStatus = '生产中' | '钻井中' | '待修井' | '关停井'

export interface StatusCount {
  name: WellStatus
  value: number
}

export interface AlarmItem {
  id: number
  wellName: string
  block: string
  alarmType: string
  level: AlarmLevel
  time: string
  status: '未处置' | '已处置'
  resolvedTime?: string
}

export type AlarmLevel = '严重' | '警告' | '提示'

export interface TrendPoint {
  label: string
  oil: number | null
  water: number | null
}

export interface AlarmBucket {
  label: string
  opened: number
  resolved: number
}

export interface OverviewData {
  total: number
  breakdown: StatusCount[]
  wells: Well[]
  unresolvedAlarms: AlarmItem[]
  updatedAt: string
}

export interface ProductionData {
  points: TrendPoint[]
  totalOil: number
  totalWater: number
  avgOil: number
  prevAvgOil: number
  oilDeltaPct: number | null
  waterDeltaPct: number | null
}

export interface AlarmsData {
  items: AlarmItem[]
  unresolved: AlarmItem[]
  currentCount: number
  prevCount: number
  resolvedInRange: number
  deltaPct: number | null
  buckets: AlarmBucket[]
}

export interface AbnormalWell {
  wellName: string
  block: string
  status: WellStatus
  level: AlarmLevel
  reasons: string[]
  latestAlarmTime?: string
}

export interface AbnormalData {
  items: AbnormalWell[]
  total: number
}

export interface ResolvedRange {
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
  label: string
  days: number
}

export const WELL_STATUSES: WellStatus[] = ['生产中', '钻井中', '待修井', '关停井']
export const ALARM_LEVELS: AlarmLevel[] = ['严重', '警告', '提示']
export const BLOCKS = ['A', 'B', 'C', 'D', 'E']

export const STATUS_COLORS: Record<WellStatus, string> = {
  生产中: '#22c55e',
  钻井中: '#3b82f6',
  待修井: '#f59e0b',
  关停井: '#ef4444'
}

export const LEVEL_TAG_TYPE: Record<AlarmLevel, 'danger' | 'warning' | 'info'> = {
  严重: 'danger',
  警告: 'warning',
  提示: 'info'
}

// ---------- 日期工具 ----------

export const pad2 = (n: number) => String(n).padStart(2, '0')

export const formatDate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export const formatDateTime = (d: Date): string =>
  `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const startOfToday = (): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** 按筛选条件解析时间范围（含等长的上一对比周期） */
export function resolveRange(filters: ReportFilters): ResolvedRange {
  const today = startOfToday()
  let start: Date
  let end: Date
  let label: string

  if (filters.rangeType === 'custom' && filters.startDate && filters.endDate) {
    start = new Date(`${filters.startDate}T00:00:00`)
    end = new Date(`${filters.endDate}T00:00:00`)
    label = `${filters.startDate} 至 ${filters.endDate}`
  } else {
    const daysMap: Record<Exclude<RangeType, 'custom'>, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '180d': 180
    }
    const days = daysMap[(filters.rangeType === 'custom' ? '7d' : filters.rangeType) as Exclude<RangeType, 'custom'>]
    start = addDays(today, -(days - 1))
    end = today
    label = { '7d': '近7天', '30d': '近30天', '90d': '近90天', '180d': '近6个月' }[
      filters.rangeType === 'custom' ? '7d' : filters.rangeType
    ] as string
  }

  if (start > end) [start, end] = [end, start]
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(prevEnd, -(days - 1))
  return { start, end, prevStart, prevEnd, label, days }
}

// ---------- mock 数据源（确定性生成，刷新后数据稳定） ----------

const MOCK_DAYS = 180

/** 确定性伪随机，保证同一入参每次得到同一结果 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface MockWell extends Well {
  base: number
  phase: number
}

function buildWells(): MockWell[] {
  // 与驾驶舱硬编码口径保持一致：156 口 = 89 生产 + 12 钻井 + 35 待修 + 20 关停
  const plan: Array<[WellStatus, number[]]> = [
    ['生产中', [22, 20, 18, 16, 13]],
    ['钻井中', [3, 3, 2, 2, 2]],
    ['待修井', [8, 7, 7, 7, 6]],
    ['关停井', [5, 4, 4, 4, 3]]
  ]
  const seq: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  const wells: MockWell[] = []
  let id = 1
  plan.forEach(([status, perBlock], sIdx) => {
    perBlock.forEach((count, bIdx) => {
      const block = BLOCKS[bIdx]
      for (let i = 0; i < count; i++) {
        seq[block] += 1
        const rnd = mulberry32(id * 7919 + sIdx * 131)
        wells.push({
          id: id++,
          name: `${block}-${String(seq[block]).padStart(2, '0')}井`,
          block,
          status,
          base: 3.5 + rnd() * 5.5,
          phase: rnd() * Math.PI * 2
        })
      }
    })
  })
  return wells
}

const mockWells = buildWells()

/** 某口生产井在第 i 天（0 = 180 天前）的日产油，确定性 */
function wellDailyOil(w: MockWell, i: number): number {
  const rnd = mulberry32(w.id * 100003 + i)
  const seasonal = 0.12 * Math.sin(i / 19 + w.phase)
  const weekly = 0.06 * Math.sin(i / 5.3 + w.phase * 0.7)
  const noise = (rnd() - 0.5) * 0.12
  const trend = 1 + i * 0.0005
  return Math.max(0.3, w.base * (1 + seasonal + weekly + noise) * trend)
}

function wellDailyWater(w: MockWell, i: number, oil: number): number {
  const rnd = mulberry32(w.id * 100007 + i * 3 + 11)
  const ratio = 2.3 + 0.35 * Math.sin(i / 23 + w.phase) + (rnd() - 0.5) * 0.25
  return oil * Math.max(1.2, ratio)
}

const ALARM_TYPES = ['钻压异常', '温度超标', '设备故障', '产量偏低', '环保指标', '泵压异常']

function buildAlarms(): AlarmItem[] {
  const list: AlarmItem[] = []
  const today = startOfToday()
  let id = 1
  const producers = mockWells.filter(w => w.status === '生产中')
  const others = mockWells.filter(w => w.status !== '生产中')

  for (let i = 0; i < MOCK_DAYS; i++) {
    const day = addDays(today, -(MOCK_DAYS - 1 - i))
    const rnd = mulberry32(i * 48271 + 17)
    const count = 0.6 + rnd() * 0.9 // 平均每天约 1 起
    let n = Math.floor(count) + (rnd() < count % 1 ? 1 : 0)
    // 周期性波动
    if (i % 27 === 13) n += 2
    for (let k = 0; k < n; k++) {
      const fromProducer = rnd() < 0.8
      const pool = fromProducer ? producers : others
      if (pool.length === 0) continue
      const w = pool[Math.floor(rnd() * pool.length)]
      const levelR = rnd()
      const level: AlarmLevel = levelR < 0.18 ? '严重' : levelR < 0.55 ? '警告' : '提示'
      const time = new Date(day)
      time.setHours(8 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0)
      if (time.getTime() > Date.now()) continue
      const resolvedDelayH = 1 + Math.floor(rnd() * 60)
      const resolvedTime = new Date(time.getTime() + resolvedDelayH * 3600000)
      list.push({
        id: id++,
        wellName: w.name,
        block: w.block,
        alarmType: ALARM_TYPES[Math.floor(rnd() * ALARM_TYPES.length)],
        level,
        time: formatDateTime(time),
        status: '已处置',
        resolvedTime: formatDateTime(resolvedTime > new Date() ? new Date() : resolvedTime)
      })
    }
  }

  // 当前 5 起未处置告警，与驾驶舱实时告警列表一致
  const now = new Date()
  const fixed: Array<[string, string, AlarmLevel, number]> = [
    ['A-01井', '钻压异常', '严重', 5],
    ['B-03井', '温度超标', '警告', 15],
    ['C-02井', '设备故障', '严重', 30],
    ['D-05井', '产量偏低', '提示', 45],
    ['E-01井', '环保指标', '警告', 60]
  ]
  fixed.forEach(([wellName, alarmType, level, mins]) => {
    const w = mockWells.find(x => x.name === wellName)!
    list.push({
      id: id++,
      wellName,
      block: w.block,
      alarmType,
      level,
      time: formatDateTime(new Date(now.getTime() - mins * 60000)),
      status: '未处置'
    })
  })

  return list.sort((a, b) => (a.time < b.time ? 1 : -1))
}

const mockAlarms = buildAlarms()

// ---------- 聚合（驾驶舱与简报共用的统计口径） ----------

const inRange = (dateStr: string, start: Date, end: Date) => {
  const t = new Date(dateStr.replace(' ', 'T')).getTime()
  return t >= start.getTime() && t <= end.getTime() + 86399999
}

export function breakdownOf(wells: Well[]): StatusCount[] {
  return WELL_STATUSES.map(name => ({
    name,
    value: wells.filter(w => w.status === name).length
  }))
}

type Granularity = 'day' | 'week' | 'month'

function granularity(days: number): Granularity {
  if (days <= 31) return 'day'
  if (days <= 95) return 'week'
  return 'month'
}

function bucketKey(d: Date, g: Granularity): string {
  if (g === 'day') return formatDate(d)
  if (g === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  // ISO 周起始日作为 key
  const day = d.getDay() || 7
  return formatDate(addDays(d, -(day - 1)))
}

function bucketLabel(key: string, g: Granularity): string {
  if (g === 'day') return key.slice(5)
  if (g === 'month') return `${key.slice(5)}月`
  const d = new Date(`${key}T00:00:00`)
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}周`
}

/** 构造从 start 到 end 连续、无空洞的桶 */
function buildBuckets(start: Date, end: Date, g: Granularity): Array<{ key: string; label: string }> {
  const keys: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = bucketKey(cursor, g)
    if (!keys.includes(key)) keys.push(key)
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys.map(key => ({ key, label: bucketLabel(key, g) }))
}

function dayIndex(d: Date): number {
  const today = startOfToday()
  return Math.round((new Date(formatDate(d) + 'T00:00:00').getTime() - today.getTime()) / 86400000) + MOCK_DAYS - 1
}

/** 按区块筛选生产井，并聚合区间产量（桶内取日均，口径同驾驶舱"日产油量"） */
function aggregateProduction(filters: ReportFilters, range: ResolvedRange) {
  const g = granularity(range.days)
  const wells = mockWells.filter(w => w.status === '生产中' && (!filters.block || w.block === filters.block))
  const buckets = buildBuckets(range.start, range.end, g)
  const sums = buckets.map(() => ({ oil: 0, water: 0, days: new Set<string>() }))

  wells.forEach(w => {
    for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) {
      const key = bucketKey(d, g)
      const bi = buckets.findIndex(b => b.key === key)
      if (bi < 0) continue
      const i = dayIndex(d)
      if (i < 0 || i >= MOCK_DAYS) continue
      const oil = wellDailyOil(w, i)
      sums[bi].oil += oil
      sums[bi].water += wellDailyWater(w, i, oil)
      sums[bi].days.add(formatDate(d))
    }
  })

  const points: Array<TrendPoint & { key: string }> = buckets.map((b, bi) => {
    const n = sums[bi].days.size || 1
    return {
      key: b.key,
      label: b.label,
      oil: Math.round((sums[bi].oil / n) * 10) / 10,
      water: Math.round((sums[bi].water / n) * 10) / 10
    }
  })

  return points
}

/** 点序列中每个时间桶覆盖的实际天数（首尾桶可能被区间截断） */
function bucketWeights(range: ResolvedRange, points: Array<TrendPoint & { key?: string }>, g: Granularity): number[] {
  return points.map(p => {
    const d0 = new Date(`${p.key}T00:00:00`)
    const lo = d0 > range.start ? d0 : new Date(range.start)
    let hi: Date
    if (g === 'day') hi = d0
    else if (g === 'month') hi = new Date(d0.getFullYear(), d0.getMonth() + 1, 0)
    else hi = addDays(d0, 6)
    if (hi > range.end) hi = new Date(range.end)
    return Math.max(0, Math.round((hi.getTime() - lo.getTime()) / 86400000) + 1)
  })
}

function rangeAverage(points: TrendPoint[], key: 'oil' | 'water'): number {
  const vals = points.map(p => p[key]).filter((v): v is number => v != null)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function filterAlarmsByLevel(alarms: AlarmItem[], levels: string[]): AlarmItem[] {
  return levels.length ? alarms.filter(a => levels.includes(a.level)) : alarms
}

// ---------- 各数据源请求（独立成功 / 空 / 失败） ----------

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function section<T>(status: SectionStatus, data: T | null, message?: string): SectionData<T> {
  return { status, data, message, loadedAt: formatDateTime(new Date()) }
}

/** 失败 / 空数据分支：data 固定为 null，按调用处的 T 标注 */
function emptySection<T>(status: SectionStatus, message?: string): SectionData<T> {
  return { status, data: null, message, loadedAt: formatDateTime(new Date()) }
}

/** 故障场景对各数据源的映射 */
function scenarioStatus(scenario: FailureScenario, key: 'overview' | 'production' | 'alarms' | 'abnormal'): SectionStatus {
  if (scenario === 'error') return 'error'
  if (scenario === 'empty') return key === 'overview' ? 'success' : 'empty'
  if (scenario === 'partial') return key === 'production' ? 'error' : 'success'
  return 'success'
}

export async function fetchOverview(
  filters: ReportFilters,
  scenario: FailureScenario = 'normal'
): Promise<SectionData<OverviewData>> {
  await delay(280)
  const st = scenarioStatus(scenario, 'overview')
  if (st === 'error') return emptySection('error', '井概览接口请求失败（HTTP 500）')
  const wells = mockWells.filter(w => !filters.block || w.block === filters.block)
  const unresolvedAlarms = filterAlarmsByLevel(
    mockAlarms
      .filter(a => a.status === '未处置' && (!filters.block || a.block === filters.block)),
    filters.alarmLevels
  )
  return section('success', {
    total: wells.length,
    breakdown: breakdownOf(wells),
    wells,
    unresolvedAlarms,
    updatedAt: formatDateTime(new Date())
  })
}

export async function fetchProduction(
  filters: ReportFilters,
  scenario: FailureScenario = 'normal'
): Promise<SectionData<ProductionData>> {
  await delay(420)
  const st = scenarioStatus(scenario, 'production')
  if (st === 'error') return emptySection('error', '产量趋势接口请求超时')
  const range = resolveRange(filters)
  const g = granularity(range.days)
  const rawPoints = aggregateProduction(filters, range)
  if (st === 'empty' || !rawPoints.length) return emptySection('empty', '所选时间范围内暂无产量数据')

  const prevRange = { ...range, start: range.prevStart, end: range.prevEnd, days: range.days }
  const prevRawPoints = aggregateProduction(filters, prevRange)
  const weights = bucketWeights(range, rawPoints, g)
  // 对外不暴露桶 key
  const stripKey = (p: TrendPoint & { key?: string }): TrendPoint => ({ label: p.label, oil: p.oil, water: p.water })
  const points: TrendPoint[] = rawPoints.map(stripKey)
  const prevPoints: TrendPoint[] = prevRawPoints.map(stripKey)

  const avgOil = rangeAverage(points, 'oil')
  const prevAvgOil = rangeAverage(prevPoints, 'oil')
  const avgWater = rangeAverage(points, 'water')
  const prevAvgWater = rangeAverage(prevPoints, 'water')

  // 区间累计 = Σ（各桶日均 × 该桶实际覆盖天数），周/月粒度的首尾桶按截断天数计
  const totalOil = Math.round(rawPoints.reduce((s, p, i) => s + (p.oil || 0) * weights[i], 0))
  const totalWater = Math.round(rawPoints.reduce((s, p, i) => s + (p.water || 0) * weights[i], 0))

  return section('success', {
    points,
    totalOil,
    totalWater,
    avgOil: Math.round(avgOil * 10) / 10,
    prevAvgOil: Math.round(prevAvgOil * 10) / 10,
    oilDeltaPct: pctChange(avgOil, prevAvgOil),
    waterDeltaPct: pctChange(avgWater, prevAvgWater)
  })
}

export async function fetchAlarms(
  filters: ReportFilters,
  scenario: FailureScenario = 'normal'
): Promise<SectionData<AlarmsData>> {
  await delay(360)
  const st = scenarioStatus(scenario, 'alarms')
  if (st === 'error') return emptySection('error', '告警接口请求失败（网络异常）')
  const range = resolveRange(filters)
  const blockFilter = (list: AlarmItem[]) =>
    list.filter(a => (!filters.block || a.block === filters.block))
  const inCurrent = filterAlarmsByLevel(
    blockFilter(mockAlarms.filter(a => inRange(a.time, range.start, range.end))),
    filters.alarmLevels
  )
  const inPrev = filterAlarmsByLevel(
    blockFilter(mockAlarms.filter(a => inRange(a.time, range.prevStart, range.prevEnd))),
    filters.alarmLevels
  )
  const items = inCurrent
  if (st === 'empty') return emptySection('empty', '所选时间范围内暂无告警记录')

  const unresolved = filterAlarmsByLevel(
    blockFilter(mockAlarms.filter(a => a.status === '未处置')),
    filters.alarmLevels
  )
  const resolvedInRange = filterAlarmsByLevel(
    blockFilter(
      mockAlarms.filter(a => a.resolvedTime && inRange(a.resolvedTime, range.start, range.end))
    ),
    filters.alarmLevels
  ).length

  const g = granularity(range.days)
  const buckets = buildBuckets(range.start, range.end, g).map(b => ({
    label: b.label,
    opened: filterAlarmsByLevel(
      blockFilter(mockAlarms.filter(a => bucketKey(new Date(a.time.replace(' ', 'T')), g) === b.key)),
      filters.alarmLevels
    ).length,
    resolved: filterAlarmsByLevel(
      blockFilter(
        mockAlarms.filter(
          a => a.resolvedTime && bucketKey(new Date(a.resolvedTime.replace(' ', 'T')), g) === b.key
        )
      ),
      filters.alarmLevels
    ).length
  }))

  return section('success', {
    items,
    unresolved,
    currentCount: items.length,
    prevCount: inPrev.length,
    resolvedInRange,
    deltaPct: pctChange(inCurrent.length, inPrev.length),
    buckets
  })
}

export async function fetchAbnormalWells(
  filters: ReportFilters,
  scenario: FailureScenario = 'normal'
): Promise<SectionData<AbnormalData>> {
  await delay(520)
  const st = scenarioStatus(scenario, 'abnormal')
  if (st === 'error') return emptySection('error', '异常井分析接口请求失败')
  const range = resolveRange(filters)
  const wells = mockWells.filter(w => !filters.block || w.block === filters.block)
  const result: AbnormalWell[] = []
  const levelRank: Record<AlarmLevel, number> = { 严重: 3, 警告: 2, 提示: 1 }

  wells.forEach(w => {
    const reasons: string[] = []
    let level: AlarmLevel | null = null
    let latestAlarmTime: string | undefined

    if (w.status === '关停井') {
      reasons.push('井状态为关停井')
      level = '严重'
    } else if (w.status === '待修井') {
      reasons.push('井状态为待修井')
      level = level && levelRank[level] > levelRank['警告'] ? level : '警告'
    }

    const wellAlarms = filterAlarmsByLevel(
      mockAlarms.filter(a => a.wellName === w.name && inRange(a.time, range.start, range.end)),
      filters.alarmLevels
    )
    if (wellAlarms.length) {
      const severe = wellAlarms.some(a => a.level === '严重')
      const warn = wellAlarms.some(a => a.level === '警告')
      const alarmLevel: AlarmLevel = severe ? '严重' : warn ? '警告' : '提示'
      if (!level || levelRank[alarmLevel] > levelRank[level]) level = alarmLevel
      const unresolvedCnt = wellAlarms.filter(a => a.status === '未处置').length
      reasons.push(
        `周期内告警 ${wellAlarms.length} 起${unresolvedCnt ? `（未处置 ${unresolvedCnt} 起）` : ''}`
      )
      latestAlarmTime = wellAlarms.map(a => a.time).sort().reverse()[0]
    }

    // 产量环比下降超过 25% 的生产井
    if (w.status === '生产中') {
      const cur = avgWellOil(w as MockWell, range.start, range.end)
      const prev = avgWellOil(w as MockWell, range.prevStart, range.prevEnd)
      if (prev > 0 && cur < prev * 0.75) {
        const drop = Math.round((1 - cur / prev) * 100)
        reasons.push(`日产油环比下降 ${drop}%`)
        if (!level || levelRank['警告'] > levelRank[level]) level = '警告'
      }
    }

    if (reasons.length) {
      const statusOk =
        !filters.wellStatuses.length || filters.wellStatuses.includes(w.status)
      if (statusOk) {
        result.push({ wellName: w.name, block: w.block, status: w.status, level: level || '提示', reasons, latestAlarmTime })
      }
    }
  })

  result.sort((a, b) => levelRank[b.level] - levelRank[a.level] || a.wellName.localeCompare(b.wellName))
  if (st === 'empty') return emptySection('empty', '所选条件下暂无异常井')
  return section('success', { items: result, total: result.length })
}

function avgWellOil(w: MockWell, start: Date, end: Date): number {
  let sum = 0
  let n = 0
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const i = dayIndex(d)
    if (i < 0 || i >= MOCK_DAYS) continue
    sum += wellDailyOil(w, i)
    n++
  }
  return n ? sum / n : 0
}

// ---------- 真实接口（后端就绪后启用） ----------
// 响应约定与 mock 分支一致，切换 USE_MOCK 即可。

const realGet = async <T>(url: string, params: Record<string, unknown>): Promise<SectionData<T>> => {
  try {
    const res = await request({ url, method: 'get', params })
    const data = (res as { data?: T }).data ?? null
    const empty =
      data == null ||
      (Array.isArray(data) && (data as unknown[]).length === 0)
    return empty ? emptySection<T>('empty') : section('success', data)
  } catch (e) {
    return emptySection('error', (e as Error)?.message || '接口请求失败')
  }
}

export function fetchOverviewRemote(filters: ReportFilters) {
  return realGet<OverviewData>('/operations/overview', { block: filters.block, alarmLevels: filters.alarmLevels })
}
export function fetchProductionRemote(filters: ReportFilters) {
  return realGet<ProductionData>('/operations/production', { ...filters, ...resolveRange(filters) })
}
export function fetchAlarmsRemote(filters: ReportFilters) {
  return realGet<AlarmsData>('/operations/alarms', { ...filters, ...resolveRange(filters) })
}
export function fetchAbnormalRemote(filters: ReportFilters) {
  return realGet<AbnormalData>('/operations/abnormal-wells', { ...filters, ...resolveRange(filters) })
}

// ---------- 简报文字生成（页面摘要 / 复制 / 下载共用） ----------

export interface MissingNote {
  key: string
  label: string
  message: string
  /** error = 接口失败（需警示）；empty = 区间无数据（中性提示） */
  severity: 'error' | 'empty'
}

export interface NarrativeParagraph {
  text: string
  /** 该段对应数据源是否降级（失败或无数据），用于页面上弱化/标色，导出文本不受影响 */
  degraded: boolean
}

export interface NarrativeResult {
  title: string
  paragraphs: NarrativeParagraph[]
  generatedAt: string
}

export function buildNarrative(
  filters: ReportFilters,
  range: ResolvedRange,
  sections: {
    overview: SectionData<OverviewData>
    production: SectionData<ProductionData>
    alarms: SectionData<AlarmsData>
    abnormal: SectionData<AbnormalData>
  }
): { narrative: NarrativeResult; missing: MissingNote[] } {
  const missing: MissingNote[] = []
  const paragraphs: NarrativeParagraph[] = []
  const push = (text: string, degraded = false) => paragraphs.push({ text, degraded })
  const blockText = filters.block ? `${filters.block} 区块` : '全部区块'
  const levelText = filters.alarmLevels.length ? `（仅统计${filters.alarmLevels.join('、')}级别）` : ''

  // 第一段：井况总览
  if (sections.overview.status === 'success' && sections.overview.data) {
    const o = sections.overview.data
    const bd = o.breakdown.map(b => `${b.name} ${b.value} 口`).join('、')
    const unh = o.unresolvedAlarms.length
    push(
      `【井况总览】${range.label}统计区间 ${formatDate(range.start)} 至 ${formatDate(range.end)}，` +
        `${blockText}共有井 ${o.total} 口，其中${bd}。当前未处置告警 ${unh} 起${levelText}，数据更新于 ${o.updatedAt}。`
    )
  } else if (sections.overview.status === 'empty') {
    push(`【井况总览】${blockText}在当前条件下暂无井数据。`, true)
  } else {
    missing.push({ key: 'overview', label: '井概览', message: sections.overview.message || '数据获取失败', severity: 'error' })
    push('【井况总览】井概览数据暂不可用，总井数与状态分布本期待确认。', true)
  }

  // 第二段：产量
  if (sections.production.status === 'success' && sections.production.data) {
    const p = sections.production.data
    const trend =
      p.oilDeltaPct == null
        ? '上一对比周期无数据，暂无环比'
        : `日产油环比${p.oilDeltaPct >= 0 ? '上升' : '下降'} ${Math.abs(p.oilDeltaPct)}%`
    const waterTrend =
      p.waterDeltaPct == null
        ? ''
        : `，日产水环比${p.waterDeltaPct >= 0 ? '上升' : '下降'} ${Math.abs(p.waterDeltaPct)}%`
    push(
      `【产量表现】区间内平均日产油 ${p.avgOil} 吨（上期 ${p.prevAvgOil} 吨），${trend}${waterTrend}；区间累计产油约 ${p.totalOil} 吨、产水约 ${p.totalWater} 吨。`
    )
  } else if (sections.production.status === 'empty') {
    push('【产量表现】所选区间内暂无产量录入，产量与环比变化本期无数据。', true)
    missing.push({ key: 'production', label: '产量趋势', message: '区间内无产量数据', severity: 'empty' })
  } else {
    push('【产量表现】产量趋势接口异常，本期产量及环比数据暂缺，已在看板中保留图表位并标注。', true)
    missing.push({ key: 'production', label: '产量趋势', message: sections.production.message || '数据获取失败', severity: 'error' })
  }

  // 第三段：告警变化
  if (sections.alarms.status === 'success' && sections.alarms.data) {
    const a = sections.alarms.data
    const cmp =
      a.deltaPct == null
        ? '上一对比周期无告警，暂无环比'
        : `较上一周期${a.deltaPct >= 0 ? '增加' : '减少'} ${Math.abs(a.deltaPct)}%`
    const severe = a.items.filter(x => x.level === '严重').length
    push(
      `【告警变化】区间内新增告警 ${a.currentCount} 起（上一周期 ${a.prevCount} 起，${cmp}），其中严重 ${severe} 起；区间内已处置 ${a.resolvedInRange} 起，当前仍有 ${a.unresolved.length} 起未处置${levelText}。`
    )
  } else if (sections.alarms.status === 'empty') {
    // 零告警属于正常结果，不计入缺失
    push('【告警变化】所选区间内无告警记录，运行平稳。')
  } else {
    push('【告警变化】告警数据接口异常，本期告警数量及环比变化暂缺。', true)
    missing.push({ key: 'alarms', label: '告警数据', message: sections.alarms.message || '数据获取失败', severity: 'error' })
  }

  // 第四段：异常井
  if (sections.abnormal.status === 'success' && sections.abnormal.data) {
    const ab = sections.abnormal.data
    if (!ab.total) {
      push('【异常井】本期未识别到异常井，生产秩序正常。')
    } else {
      const top = ab.items.slice(0, 5)
      const detail = top
        .map(x => `${x.wellName}（${x.reasons.join('、')}）`)
        .join('；')
      push(
        `【异常井】共识别异常井 ${ab.total} 口，重点关注：${detail}${ab.total > 5 ? ' 等' : ''}。建议优先跟踪严重级别井位并核实处置进展。`
      )
    }
  } else if (sections.abnormal.status === 'empty') {
    // 无异常井属于正常结果
    push('【异常井】当前筛选条件下无异常井。')
  } else {
    push('【异常井】异常井分析数据暂不可用，异常井名单本期缺失。', true)
    missing.push({ key: 'abnormal', label: '异常井', message: sections.abnormal.message || '数据获取失败', severity: 'error' })
  }

  const generatedAt = formatDateTime(new Date())
  return {
    narrative: {
      title: `运营简报 · ${range.label} · ${blockText}`,
      paragraphs,
      generatedAt
    },
    missing
  }
}

/** 简报纯文本（复制到剪贴板 / 下载 .txt 用） */
export function narrativeToText(n: NarrativeResult, missing: MissingNote[], range: ResolvedRange): string {
  const lines = [
    n.title,
    `统计区间：${formatDate(range.start)} 至 ${formatDate(range.end)}`,
    `生成时间：${n.generatedAt}`,
    '统计口径：与综合驾驶舱一致（井状态为实时值，产量为区间日均，告警按发生时间统计）',
    '',
    ...n.paragraphs.map(p => p.text)
  ]
  const failed = missing.filter(m => m.severity === 'error')
  const empties = missing.filter(m => m.severity === 'empty')
  if (failed.length) {
    lines.push('', '【数据缺失说明】')
    failed.forEach(m => lines.push(`- ${m.label}：${m.message}`))
  }
  if (empties.length) {
    lines.push('', '【无数据说明】')
    empties.forEach(m => lines.push(`- ${m.label}：${m.message}`))
  }
  return lines.join('\n')
}
