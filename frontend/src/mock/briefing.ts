/**
 * 运营简报模拟数据源（后端不可用时由 service 层回退到此实现）。
 *
 * 关键口径与综合驾驶舱完全一致：
 *  - 总井数 156 = 生产中 89 + 钻井中 12 + 待修井 35 + 关停井 20
 *  - 当前未处理告警 5 条（与驾驶舱实时告警表格一致）
 *  - 产量趋势为生产井日产油 / 日产水汇总
 *
 * 基准日固定为 2024-06-30，数据集在模块加载时生成一次并缓存，
 * 使用确定性伪随机，保证同一筛选条件多次进入结果一致。
 */
import type {
  AlarmLevel,
  AlarmRecord,
  BlockName,
  ProductionRecord,
  WellRecord,
  WellStatus,
  WellType
} from '@/types/briefing'

/** 模拟数据的「当前时刻」基准日 */
export const MOCK_TODAY = '2024-06-30'

const BLOCKS: BlockName[] = ['胜利油田', '大庆油田', '辽河油田', '长庆油田']
const WELL_TYPES: WellType[] = ['开发井', '探井', '评价井']
const STATUS_PLAN: { status: WellStatus; count: number }[] = [
  { status: '生产中', count: 89 },
  { status: '钻井中', count: 12 },
  { status: '待修井', count: 35 },
  { status: '关停井', count: 20 }
]

const ALARM_TYPES = ['钻压异常', '温度超标', '设备故障', '产量偏低', '环保指标', '压力异常', '含水超标', '通讯中断']

/** mulberry32 确定性伪随机数生成器 */
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

const rand = mulberry32(20240630)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const round1 = (n: number) => Math.round(n * 10) / 10

interface GeneratedDataset {
  wells: WellRecord[]
  alarms: AlarmRecord[]
  production: ProductionRecord[]
}

let cache: GeneratedDataset | null = null

export function getMockDataset(): GeneratedDataset {
  if (cache) return cache

  const wells: WellRecord[] = []

  // 前 5 口井与驾驶舱实时告警 / 井位管理页面的演示数据保持同名
  const head: Array<Partial<WellRecord> & Pick<WellRecord, 'wellCode' | 'wellName' | 'wellType' | 'status'>> = [
    { wellCode: 'A-001', wellName: 'A-01井', wellType: '开发井', status: '生产中' },
    { wellCode: 'B-003', wellName: 'B-03井', wellType: '探井', status: '钻井中' },
    { wellCode: 'C-002', wellName: 'C-02井', wellType: '开发井', status: '生产中' },
    { wellCode: 'D-005', wellName: 'D-05井', wellType: '评价井', status: '待修井' },
    { wellCode: 'E-001', wellName: 'E-01井', wellType: '开发井', status: '关停井' }
  ]

  let id = 0
  const prefixByBlock: Record<BlockName, string> = {
    胜利油田: 'A',
    大庆油田: 'B',
    辽河油田: 'C',
    长庆油田: 'D'
  }

  const pushWell = (
    overrides: Partial<WellRecord> & Pick<WellRecord, 'wellCode' | 'wellName' | 'status'>
  ) => {
    id += 1
    const block = overrides.blockName ?? pick(BLOCKS)
    wells.push({
      id,
      wellCode: overrides.wellCode,
      wellName: overrides.wellName,
      wellType: overrides.wellType ?? pick(WELL_TYPES),
      blockName: block,
      longitude: round1(108 + rand() * 12),
      latitude: round1(36 + rand() * 4),
      designDepth: 3000 + Math.floor(rand() * 2000),
      status: overrides.status,
      createTime: `2023-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(
        1 + Math.floor(rand() * 28)
      ).padStart(2, '0')} 09:00:00`
    })
  }

  head.forEach((w) =>
    pushWell({ ...w, blockName: '胜利油田', longitude: 118.5 + rand() * 0.8, latitude: 38.2 + rand() * 0.6 })
  )

  STATUS_PLAN.forEach(({ status, count }) => {
    const already = head.filter((w) => w.status === status).length
    const prefix = 'X' // 先占位，稍后按区块重排井号
    for (let i = 0; i < count - already; i++) {
      pushWell({
        wellCode: `${prefix}-${String(id + 1).padStart(3, '0')}`,
        wellName: `${prefix}-${id + 1}井`,
        status
      })
    }
  })

  // 按区块重新生成可读井号
  const seqByBlock: Record<string, number> = {}
  wells.forEach((w) => {
    if (['A-001', 'B-003', 'C-002', 'D-005', 'E-001'].includes(w.wellCode)) return
    const p = prefixByBlock[w.blockName]
    seqByBlock[p] = (seqByBlock[p] || 10) + 1
    w.wellCode = `${p}-${String(seqByBlock[p]).padStart(3, '0')}`
    w.wellName = `${p}-${seqByBlock[p]}井`
  })

  // ---------- 产量：120 天，生产井全量；待修/关停井在停井日前有产量 ----------
  const production: ProductionRecord[] = []
  const days = 120
  const start = new Date(2024, 2, 3) // 2024-03-03，恰好覆盖至 06-30
  const dateList: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dateList.push(`${y}-${m}-${day}`)
  }

  // 6 口产量持续下滑的异常生产井
  const decliningIds = new Set(wells.filter((w) => w.status === '生产中').slice(6, 12).map((w) => w.id))

  wells.forEach((w) => {
    const baseOil = 0.8 + rand() * 2.6
    const waterRatio = 2.0 + rand() * 1.6
    let stopIndex = days // 不含停当日
    if (w.status === '关停井') stopIndex = 55 + Math.floor(rand() * 45) // 5/01 ~ 6/19 间停
    if (w.status === '待修井') stopIndex = 85 + Math.floor(rand() * 30) // 6/01 ~ 6/28 间停
    if (w.status === '钻井中') stopIndex = 0

    for (let i = 0; i < stopIndex && i < days; i++) {
      let factor = 1
      if (decliningIds.has(w.id)) factor = 1 - 0.45 * (i / days)
      const noise = 0.85 + rand() * 0.3
      const oil = round1(baseOil * factor * noise)
      const water = round1(oil * waterRatio * (0.9 + rand() * 0.2))
      production.push({ wellId: w.id, date: dateList[i], oil, water })
    }
  })

  // ---------- 告警：近 60 天共约 120 条；最近 5 条未处理，与驾驶舱一致 ----------
  const alarms: AlarmRecord[] = []
  const fixedOpen: Array<{ wellCode: string; alarmType: string; level: AlarmLevel; time: string }> = [
    { wellCode: 'A-001', alarmType: '钻压异常', level: '严重', time: `${MOCK_TODAY} 10:30` },
    { wellCode: 'B-003', alarmType: '温度超标', level: '警告', time: `${MOCK_TODAY} 10:25` },
    { wellCode: 'C-002', alarmType: '设备故障', level: '严重', time: `${MOCK_TODAY} 10:15` },
    { wellCode: 'D-005', alarmType: '产量偏低', level: '提示', time: `${MOCK_TODAY} 10:00` },
    { wellCode: 'E-001', alarmType: '环保指标', level: '警告', time: `${MOCK_TODAY} 09:45` }
  ]

  let alarmId = 0
  fixedOpen.forEach((a) => {
    const well = wells.find((w) => w.wellCode === a.wellCode)!
    alarmId += 1
    alarms.push({
      id: alarmId,
      wellId: well.id,
      wellName: well.wellName,
      blockName: well.blockName,
      alarmType: a.alarmType,
      level: a.level,
      time: a.time,
      status: '未处理'
    })
  })

  // 基准日之前 59 天的历史告警，均已处理
  const wellPool = wells.filter((w) => w.status !== '关停井' || rand() > 0.5)
  const baseDate = new Date(2024, 5, 30)
  for (let back = 1; back <= 59; back++) {
    const d = new Date(2024, baseDate.getMonth(), baseDate.getDate() - back)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    const count = 1 + Math.floor(rand() * 3) // 每天 1~3 条
    for (let k = 0; k < count; k++) {
      const well = wellPool[Math.floor(rand() * wellPool.length)]
      const r = rand()
      const level: AlarmLevel = r < 0.2 ? '严重' : r < 0.65 ? '警告' : '提示'
      alarmId += 1
      alarms.push({
        id: alarmId,
        wellId: well.id,
        wellName: well.wellName,
        blockName: well.blockName,
        alarmType: pick(ALARM_TYPES),
        level,
        time: `${dateStr} ${String(6 + Math.floor(rand() * 16)).padStart(2, '0')}:${String(
          Math.floor(rand() * 60)
        ).padStart(2, '0')}`,
        status: '已处理'
      })
    }
  }

  alarms.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))

  cache = { wells, alarms, production }
  return cache
}
