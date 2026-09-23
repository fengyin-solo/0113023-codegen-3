/** 运营简报 / 驾驶舱共享数据类型 */

export type AlarmLevel = '严重' | '警告' | '提示'

export type WellStatus = '生产中' | '钻井中' | '待修井' | '关停井'

export type WellType = '探井' | '开发井' | '评价井'

export type BlockName = '胜利油田' | '大庆油田' | '辽河油田' | '长庆油田'

/** 简报筛选条件，也是一个可保存视图的完整描述 */
export interface BriefingFilter {
  /** 起始日期 YYYY-MM-DD */
  startDate: string
  /** 结束日期 YYYY-MM-DD */
  endDate: string
  /** 区块，空字符串表示全部 */
  block: string
  /** 井型，空字符串表示全部 */
  wellType: string
  /** 告警级别，空字符串表示全部 */
  alarmLevel: string
}

export interface WellRecord {
  id: number
  wellCode: string
  wellName: string
  wellType: WellType
  blockName: BlockName
  longitude: number
  latitude: number
  designDepth: number
  status: WellStatus
  createTime: string
}

export interface AlarmRecord {
  id: number
  wellId: number
  wellName: string
  blockName: BlockName
  alarmType: string
  level: AlarmLevel
  time: string
  status: '未处理' | '已处理'
}

/** 单井某日产量记录 */
export interface ProductionRecord {
  wellId: number
  date: string
  oil: number
  water: number
}

export interface StatusDistributionItem {
  name: WellStatus
  value: number
}

/** 与驾驶舱四张统计卡 / 饼图完全一致的口径快照 */
export interface WellOverview {
  wellCount: number
  drillingCount: number
  productionCount: number
  /** 当前未处理告警数，与驾驶舱「告警数量」卡一致 */
  alarmCount: number
  statusDistribution: StatusDistributionItem[]
  maintenanceCount: number
  shutdownCount: number
  openAlarms: AlarmRecord[]
}

export interface AlarmChanges {
  /** 时间范围内新增告警（含未处理 / 已处理） */
  totalInRange: number
  /** 时间范围内新产生且仍未处理 */
  unresolvedInRange: number
  /** 时间范围内已处理闭环 */
  resolvedInRange: number
  /** 范围内未处理 - 等长上一周期未处理 */
  unresolvedDelta: number
  /** 范围内告警总数 - 等长上一周期告警总数 */
  totalDelta: number
  severeCount: number
  warningCount: number
  infoCount: number
  /** 按日期展开，供趋势/列表使用 */
  alarms: AlarmRecord[]
}

export interface ProductionPoint {
  date: string
  oil: number
  water: number
}

export interface ProductionSummary {
  series: ProductionPoint[]
  totalOil: number
  totalWater: number
  avgDailyOil: number
  avgDailyWater: number
  prevTotalOil: number
  prevTotalWater: number
  /** 产油量环比变化率（小数），上周期为 0 时为 null */
  oilChangeRate: number | null
  waterChangeRate: number | null
}

export type AbnormalReason = '严重告警未处理' | '待修井' | '关停井' | '产量环比下滑超阈值'

export interface AbnormalWell {
  wellId: number
  wellName: string
  blockName: BlockName
  status: WellStatus
  reasons: AbnormalReason[]
  /** 本周期产油（无产量数据时为 null） */
  currentOil: number | null
  /** 等长上周期产油 */
  previousOil: number | null
  /** 环比变化率，无法计算时为 null */
  changeRate: number | null
  unresolvedSerious: number
}

/** 单个数据分区的加载状态，各分区互不影响 */
export type SectionStatus = 'loading' | 'success' | 'error' | 'empty'

/** 后端统一响应包装（与 utils/request 的解包约定一致） */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}
