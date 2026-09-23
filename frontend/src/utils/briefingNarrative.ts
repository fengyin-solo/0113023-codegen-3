/**
 * 运营简报「一段可分享摘要」的文案生成器。
 * 输入各分区当前数据（缺失分区传 null），输出带缺失标注的纯文本简报。
 */
import type {
  AbnormalWell,
  AlarmChanges,
  ProductionSummary,
  WellOverview
} from '@/types/briefing'
import { daySpan } from '@/utils/date'

export interface BriefingNarrativeInput {
  startDate: string
  endDate: string
  block: string
  wellType: string
  alarmLevel: string
  overview: WellOverview | null
  alarm: AlarmChanges | null
  production: ProductionSummary | null
  abnormalWells: AbnormalWell[] | null
}

function pctText(rate: number | null): string {
  if (rate === null) return '无上周期数据，无法计算环比'
  const pct = (rate * 100).toFixed(1)
  return rate >= 0 ? `环比 +${pct}%` : `环比 ${pct}%`
}

function deltaText(delta: number, unit: string): string {
  if (delta > 0) return `较上周期增加 ${delta}${unit}`
  if (delta < 0) return `较上周期减少 ${Math.abs(delta)}${unit}`
  return '与上周期持平'
}

/** 生成多段纯文本简报（数组每个元素为一段），并汇总缺失分区 */
export function buildBriefingNarrative(input: BriefingNarrativeInput): {
  paragraphs: string[]
  missing: string[]
} {
  const { startDate, endDate, overview, alarm, production, abnormalWells } = input
  const paragraphs: string[] = []
  const missing: string[] = []

  const scopes: string[] = []
  if (input.block) scopes.push(`区块=${input.block}`)
  if (input.wellType) scopes.push(`井型=${input.wellType}`)
  if (input.alarmLevel) scopes.push(`告警级别=${input.alarmLevel}`)
  const scopeText = scopes.length > 0 ? `（筛选：${scopes.join('，')}）` : ''

  paragraphs.push(
    `【运营简报】${startDate} 至 ${endDate}（共 ${daySpan(startDate, endDate)} 天）${scopeText}`
  )

  if (overview) {
    const dist = overview.statusDistribution.map((d) => `${d.name}${d.value}口`).join('、')
    paragraphs.push(
      `一、井况总览：纳入统计共 ${overview.wellCount} 口井，其中${dist}；` +
        `当前未处理告警 ${overview.alarmCount} 条。`
    )
  } else {
    missing.push('关键指标')
  }

  if (production) {
    paragraphs.push(
      `二、产量情况：本周期累计产油 ${production.totalOil} 吨（${pctText(
        production.oilChangeRate
      )}），累计产水 ${production.totalWater} 吨（${pctText(
        production.waterChangeRate
      )}）；日均产油 ${production.avgDailyOil} 吨，日均产水 ${production.avgDailyWater} 吨。`
    )
  } else {
    missing.push('产量趋势')
  }

  if (alarm) {
    paragraphs.push(
      `三、告警变化：本周期共发生告警 ${alarm.totalInRange} 条（${deltaText(
        alarm.totalDelta,
        ' 条'
      )}），其中严重 ${alarm.severeCount} 条、警告 ${alarm.warningCount} 条、提示 ${alarm.infoCount} 条；` +
        `未处理 ${alarm.unresolvedInRange} 条（${deltaText(alarm.unresolvedDelta, ' 条')}），已闭环 ${alarm.resolvedInRange} 条。`
    )
  } else {
    missing.push('告警变化')
  }

  if (abnormalWells !== null) {
    if (abnormalWells.length === 0) {
      paragraphs.push('四、异常井：本周期未发现异常井。')
    } else {
      const top = abnormalWells.slice(0, 5)
      const detail = top
        .map((w) => {
          // 状态本身已能表达「待修井 / 关停井」，文案上去重避免「关停井（关停井）」
          const reasons = w.reasons.filter((r) => r !== w.status)
          const tail: string[] = []
          if (reasons.length > 0) tail.push(reasons.join('、'))
          if (w.changeRate !== null) tail.push(`产油环比 ${(w.changeRate * 100).toFixed(1)}%`)
          return `${w.wellName}（${w.status}${tail.length ? '，' + tail.join('，') : ''}）`
        })
        .join('；')
      paragraphs.push(
        `四、异常井：共 ${abnormalWells.length} 口异常井，重点关注：${detail}${
          abnormalWells.length > top.length ? ` 等 ${abnormalWells.length} 口` : ''
        }。`
      )
    }
  } else {
    missing.push('异常井')
  }

  if (missing.length > 0) {
    paragraphs.push(`注：${missing.join('、')}数据暂不可用，相关结论缺失，待接口恢复后补充。`)
  }

  return { paragraphs, missing }
}

export function narrativeToText(input: BriefingNarrativeInput): string {
  return buildBriefingNarrative(input).paragraphs.join('\n\n')
}
