/** 简报模块使用的纯日期工具，避免依赖第三方日期库 */

export const DAY_MS = 24 * 60 * 60 * 1000

/** Date -> YYYY-MM-DD（本地时区） */
export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD -> Date（本地零点） */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 加减天数，返回新 Date */
export function addDays(d: Date, delta: number): Date {
  return new Date(d.getTime() + delta * DAY_MS)
}

/** 返回 [start, end] 之间的天数（含两端），区间非法时返回 0 */
export function daySpan(start: string, end: string): number {
  const diff = parseDate(end).getTime() - parseDate(start).getTime()
  if (Number.isNaN(diff) || diff < 0) return 0
  return Math.round(diff / DAY_MS) + 1
}

/** 以结束日为基准，取之前 n 天的自然日区间（含结束日） */
export function rangeFromEnd(end: string, days: number): { startDate: string; endDate: string } {
  const endDate = parseDate(end)
  return { startDate: formatDate(addDays(endDate, -(days - 1))), endDate: end }
}

/** 与 [start, end] 等长、紧邻其前的区间，用于环比 */
export function previousRange(start: string, end: string): { startDate: string; endDate: string } {
  const span = daySpan(start, end)
  const prevEnd = addDays(parseDate(start), -1)
  return { startDate: formatDate(addDays(prevEnd, -(span - 1))), endDate: formatDate(prevEnd) }
}

/** 以「今天」为结束日的近 n 天区间 */
export function recentRange(days: number, now: Date = new Date()): { startDate: string; endDate: string } {
  const end = formatDate(now)
  return rangeFromEnd(end, days)
}

/** YYYY-MM-DD -> MM-DD，用于图表轴 */
export function shortLabel(date: string): string {
  return date.slice(5)
}

export function formatDateTime(d: Date): string {
  const date = formatDate(d)
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${date} ${h}:${min}`
}
