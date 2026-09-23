/**
 * 运营简报数据加载：四个分区各自维护 loading / success / empty / error，
 * 单个分区失败不阻塞其余分区；通过请求序号丢弃过期响应，避免竞态。
 */
import { reactive, ref } from 'vue'
import type {
  AbnormalWell,
  AlarmChanges,
  BriefingFilter,
  ProductionSummary,
  SectionStatus,
  WellOverview
} from '@/types/briefing'
import type { BriefingSection, SectionResult } from '@/api/briefing'
import {
  getAbnormalWells,
  getAlarmChanges,
  getOverview,
  getProduction
} from '@/services/briefingService'

interface SectionState<T> {
  status: SectionStatus
  data: T | null
  errorMessage: string
  /** 是否由接口失败降级而来（数据可用但需标明非实时） */
  degraded: boolean
}

function emptySection<T>(): SectionState<T> {
  return { status: 'loading', data: null, errorMessage: '', degraded: false }
}

export function useBriefingData() {
  const overview = reactive<SectionState<WellOverview>>(emptySection())
  const alarm = reactive<SectionState<AlarmChanges>>(emptySection())
  const production = reactive<SectionState<ProductionSummary>>(emptySection())
  const abnormal = reactive<SectionState<AbnormalWell[]>>(emptySection())
  const loading = ref(false)

  let requestSeq = 0

  function applyResult<T>(
    state: SectionState<T>,
    result: SectionResult<T>,
    isEmpty: (data: T) => boolean
  ) {
    state.data = result.data
    state.degraded = !!result.degraded
    state.errorMessage = result.errorMessage || ''
    state.status = isEmpty(result.data) ? 'empty' : 'success'
  }

  function applyError<T>(state: SectionState<T>, err: unknown) {
    state.status = 'error'
    state.data = null
    state.degraded = false
    state.errorMessage = err instanceof Error ? err.message : '数据加载失败'
  }

  async function load(filter: BriefingFilter) {
    const seq = ++requestSeq
    loading.value = true

    const reset = <T>(state: SectionState<T>) => {
      state.status = 'loading'
      state.data = null
      state.errorMessage = ''
      state.degraded = false
    }

    const sections: { state: SectionState<any>; run: () => Promise<SectionResult<any>>; isEmpty: (d: any) => boolean }[] = [
      {
        state: overview,
        run: () => getOverview(filter),
        isEmpty: (d: WellOverview) => d.wellCount === 0
      },
      {
        state: alarm,
        run: () => getAlarmChanges(filter),
        isEmpty: (d: AlarmChanges) => d.totalInRange === 0 && d.unresolvedInRange === 0
      },
      {
        state: production,
        run: () => getProduction(filter),
        isEmpty: (d: ProductionSummary) => d.totalOil === 0 && d.totalWater === 0
      },
      {
        state: abnormal,
        run: () => getAbnormalWells(filter),
        isEmpty: (d: AbnormalWell[]) => d.length === 0
      }
    ]

    sections.forEach(({ state }) => reset(state))

    await Promise.all(
      sections.map(async ({ state, run, isEmpty }) => {
        try {
          const result = await run()
          if (seq !== requestSeq) return // 已有更新的查询发起，丢弃过期结果
          applyResult(state, result, isEmpty)
        } catch (err) {
          if (seq !== requestSeq) return
          applyError(state, err)
        }
      })
    )

    if (seq === requestSeq) loading.value = false
  }

  async function retry(section: BriefingSection, filter: BriefingFilter) {
    const target: {
      state: SectionState<any>
      run: () => Promise<SectionResult<any>>
      isEmpty: (d: any) => boolean
    } =
      section === 'overview'
        ? { state: overview, run: () => getOverview(filter), isEmpty: (d: WellOverview) => d.wellCount === 0 }
        : section === 'alarm'
          ? {
              state: alarm,
              run: () => getAlarmChanges(filter),
              isEmpty: (d: AlarmChanges) => d.totalInRange === 0 && d.unresolvedInRange === 0
            }
          : section === 'production'
            ? {
                state: production,
                run: () => getProduction(filter),
                isEmpty: (d: ProductionSummary) => d.totalOil === 0 && d.totalWater === 0
              }
            : {
                state: abnormal,
                run: () => getAbnormalWells(filter),
                isEmpty: (d: AbnormalWell[]) => d.length === 0
              }

    target.state.status = 'loading'
    target.state.errorMessage = ''
    try {
      applyResult(target.state, await target.run(), target.isEmpty)
    } catch (err) {
      applyError(target.state, err)
    }
  }

  return {
    loading,
    overview,
    alarm,
    production,
    abnormal,
    load,
    retry
  }
}
