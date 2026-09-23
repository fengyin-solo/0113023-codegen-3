import request from '@/utils/request'
import type {
  AbnormalWell,
  AlarmChanges,
  BriefingFilter,
  ProductionSummary,
  WellOverview
} from '@/types/briefing'

/** 运营简报四个数据分区，各自独立请求 / 独立降级 */

export function fetchOverviewApi(filter: BriefingFilter) {
  return request({
    url: '/briefing/overview',
    method: 'get',
    params: filter,
    skipErrorToast: true
  })
}

export function fetchAlarmChangesApi(filter: BriefingFilter) {
  return request({
    url: '/briefing/alarm-changes',
    method: 'get',
    params: filter,
    skipErrorToast: true
  })
}

export function fetchProductionApi(filter: BriefingFilter) {
  return request({
    url: '/briefing/production',
    method: 'get',
    params: filter,
    skipErrorToast: true
  })
}

export function fetchAbnormalWellsApi(filter: BriefingFilter) {
  return request({
    url: '/briefing/abnormal-wells',
    method: 'get',
    params: filter,
    skipErrorToast: true
  })
}

export type BriefingSection = 'overview' | 'alarm' | 'production' | 'abnormal'

export interface SectionResult<T> {
  data: T
  /** 数据来源：real = 后端真实接口；mock = 接口失败后的本地回退数据 */
  source: 'real' | 'mock'
  /** 接口失败但回退成功时的错误信息，用于在界面上标明缺失 */
  degraded?: boolean
  errorMessage?: string
}

export interface OverviewBundle {
  overview: WellOverview
}
export interface ProductionBundle {
  production: ProductionSummary
}
export interface AbnormalBundle {
  abnormalWells: AbnormalWell[]
}
export type AlarmBundle = AlarmChanges
