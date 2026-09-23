/**
 * 运营简报数据服务：真实接口优先、按分区独立降级到本地模拟数据。
 *
 * 每个分区单独请求 / 单独 catch，任一分区失败不影响其他分区；
 * 全部失败时各分区状态为 error，页面仍可渲染筛选条件与说明文案。
 * 真实接口与模拟回退共用 utils/briefingStats 中的统计函数，口径一致。
 */
import {
  fetchAbnormalWellsApi,
  fetchAlarmChangesApi,
  fetchOverviewApi,
  fetchProductionApi,
  type AbnormalBundle,
  type AlarmBundle,
  type BriefingSection,
  type OverviewBundle,
  type ProductionBundle,
  type SectionResult
} from '@/api/briefing'
import { getMockDataset, MOCK_TODAY } from '@/mock/briefing'
import type { BriefingFilter } from '@/types/briefing'
import {
  aggregateAbnormalWells,
  aggregateAlarmChanges,
  aggregateMonthlyProduction,
  aggregateOverview,
  aggregateProduction,
  filterWells,
  openAlarmsWithin
} from '@/utils/briefingStats'

/**
 * 数据源开关：
 *  - false（默认）：仅使用本地模拟数据（后端尚未就绪，避免每次等待超时）
 *  - true：先请求真实接口，失败再回退本地模拟数据
 * 后端就绪后将 USE_REMOTE 置为 true 即可全量走接口。
 */
export const USE_REMOTE = false

/**
 * 开发期故障模拟：标记为 true 的分区会让回退数据也不可用，
 * 用于验证「接口失败 / 部分图表不可用」时的页面降级表现。
 */
export const forcedFailures = new Set<BriefingSection>()

export function sectionLabel(section: BriefingSection): string {
  const map: Record<BriefingSection, string> = {
    overview: '关键指标',
    alarm: '告警变化',
    production: '产量趋势',
    abnormal: '异常井'
  }
  return map[section]
}

function mockOverview(filter: BriefingFilter): OverviewBundle {
  const { wells, alarms } = getMockDataset()
  const scopedWells = filterWells(wells, filter)
  const wellIds = new Set(scopedWells.map((w) => w.id))
  return {
    overview: aggregateOverview(scopedWells, openAlarmsWithin(alarms, wellIds, filter))
  }
}

function mockAlarmChanges(filter: BriefingFilter): AlarmBundle {
  const { wells, alarms } = getMockDataset()
  const scopedWells = filterWells(wells, filter)
  return aggregateAlarmChanges(alarms, new Set(scopedWells.map((w) => w.id)), filter)
}

function mockProduction(filter: BriefingFilter): ProductionBundle {
  const { wells, production } = getMockDataset()
  const scopedWells = filterWells(wells, filter)
  return {
    production: aggregateProduction(production, new Set(scopedWells.map((w) => w.id)), filter)
  }
}

function mockAbnormal(filter: BriefingFilter): AbnormalBundle {
  const { wells, production, alarms } = getMockDataset()
  return {
    abnormalWells: aggregateAbnormalWells(filterWells(wells, filter), production, alarms, filter)
  }
}

/** 综合驾驶舱快照：总览 + 月度趋势，一次获取 */
export interface DashboardBundle {
  overview: OverviewBundle['overview']
  monthly: ReturnType<typeof aggregateMonthlyProduction>
}

function mockDashboard(): DashboardBundle {
  const { wells, alarms, production } = getMockDataset()
  const wellIds = new Set(wells.map((w) => w.id))
  const allFilter: BriefingFilter = {
    startDate: '0000-01-01',
    endDate: '9999-12-31',
    block: '',
    wellType: '',
    alarmLevel: ''
  }
  return {
    overview: aggregateOverview(wells, openAlarmsWithin(alarms, wellIds, allFilter)),
    monthly: aggregateMonthlyProduction(production, wellIds, MOCK_TODAY)
  }
}

export function getDashboardSnapshot() {
  return withFallback(
    'overview',
    async () => {
      const res = await fetchOverviewApi({
        startDate: '0000-01-01',
        endDate: '9999-12-31',
        block: '',
        wellType: '',
        alarmLevel: ''
      })
      return { data: res.data as unknown as DashboardBundle }
    },
    () => mockDashboard()
  )
}

async function withFallback<T>(
  section: BriefingSection,
  remote: () => Promise<{ data: T }>,
  fallback: () => T
): Promise<SectionResult<T>> {
  if (forcedFailures.has(section)) {
    throw new Error(`「${sectionLabel(section)}」数据源不可用（模拟故障）`)
  }

  if (USE_REMOTE) {
    try {
      const res = await remote()
      return { data: res.data, source: 'real' }
    } catch (err) {
      // 接口失败：降级到本地数据，并显式标明
      const data = fallback()
      return {
        data,
        source: 'mock',
        degraded: true,
        errorMessage: err instanceof Error ? err.message : '接口请求失败'
      }
    }
  }

  return { data: fallback(), source: 'mock' }
}

export function getOverview(filter: BriefingFilter) {
  return withFallback(
    'overview',
    () => fetchOverviewApi(filter) as Promise<{ data: OverviewBundle }>,
    () => mockOverview(filter)
  )
}

export function getAlarmChanges(filter: BriefingFilter) {
  return withFallback(
    'alarm',
    () => fetchAlarmChangesApi(filter) as Promise<{ data: AlarmBundle }>,
    () => mockAlarmChanges(filter)
  )
}

export function getProduction(filter: BriefingFilter) {
  return withFallback(
    'production',
    () => fetchProductionApi(filter) as Promise<{ data: ProductionBundle }>,
    () => mockProduction(filter)
  )
}

export function getAbnormalWells(filter: BriefingFilter) {
  return withFallback(
    'abnormal',
    () => fetchAbnormalWellsApi(filter) as Promise<{ data: AbnormalBundle }>,
    () => mockAbnormal(filter)
  )
}
