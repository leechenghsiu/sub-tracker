import type { Subscription, Card, ScheduleEvent, Reminder, PayReminder } from '@/components/types'

const DEFAULT_REMINDER: Reminder = { enabled: false, daysBefore: 1 }
const DEFAULT_PAY_REMINDER: PayReminder = { enabled: false, daysAfter: 1 }

// 回傳指定年月中「幾號」對應的實際日期；若超過當月天數，取當月最後一天。
export function resolveDayInMonth(day: number, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

// 將表單輸入的「提前天數」轉為合法值。0 代表扣款當天提醒，必須保留，
// 因此不能用 `Number(x) || 1` —— 那會把 0 當成 falsy 而回退成 1。
export function normalizeDaysBefore(value: string): number {
  const n = Number(value)
  if (value.trim() === '' || !Number.isFinite(n)) return 1
  return Math.max(0, Math.floor(n))
}

// 以某日期為基準，加減 n 天（可跨月）。
export function shiftDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// 取卡片的「可繳費提醒」設定（向後相容：舊卡片無此欄位時視為關閉）。
function getPayReminder(card: Card): PayReminder {
  return card.payReminder ?? DEFAULT_PAY_REMINDER
}

// 取卡片的「到期前提醒」設定（向後相容：舊卡片的單一 reminder 視為到期前提醒）。
function getDueReminder(card: Card): Reminder {
  return card.dueReminder ?? card.reminder ?? DEFAULT_REMINDER
}

// 判斷某 cycle 的定期項目在目標 year/month 是否有扣款。
export function isChargeInMonth(billingDate: string, cycle: string, year: number, month: number): boolean {
  const start = new Date(billingDate)
  const monthsDiff = (year - start.getFullYear()) * 12 + (month - start.getMonth())
  if (monthsDiff < 0) return false
  if (cycle === 'monthly') return true
  if (cycle === 'halfyear') return monthsDiff % 6 === 0
  if (cycle === 'yearly') return monthsDiff % 12 === 0
  return false
}

// 彙整某月份的所有財務事件，依日期升冪排序。
export function getMonthlyEvents(
  subscriptions: Subscription[],
  cards: Card[],
  year: number,
  month: number,
): ScheduleEvent[] {
  const events: ScheduleEvent[] = []

  for (const sub of subscriptions) {
    if (sub.deletedAt || !sub.billingDate) continue
    if (!isChargeInMonth(sub.billingDate, sub.cycle, year, month)) continue
    const day = new Date(sub.billingDate).getDate()
    const date = resolveDayInMonth(day, year, month)
    const reminder = sub.reminder ?? DEFAULT_REMINDER
    events.push({
      date,
      kind: 'charge',
      title: sub.name,
      category: sub.category ?? 'subscription',
      amount: sub.price,
      currency: sub.currency,
      reminder,
      reminderDate: reminder.enabled ? shiftDays(date, -reminder.daysBefore) : undefined,
      sourceId: sub._id,
    })
  }

  for (const card of cards) {
    if (card.deletedAt) continue
    // 結帳事件：可繳費提醒（結帳日隔 daysAfter 天）
    const statementDate = resolveDayInMonth(card.statementDay, year, month)
    const pay = getPayReminder(card)
    events.push({
      date: statementDate,
      kind: 'statement',
      title: card.name,
      cardName: card.name,
      reminderDate: pay.enabled ? shiftDays(statementDate, pay.daysAfter) : undefined,
      sourceId: card._id,
    })
    // 繳費截止事件：到期前提醒（截止日前 daysBefore 天）。繳費截止日為選填，未填則不產生。
    if (card.dueDay != null) {
      const dueDate = resolveDayInMonth(card.dueDay, year, month)
      const due = getDueReminder(card)
      events.push({
        date: dueDate,
        kind: 'due',
        title: card.name,
        cardName: card.name,
        reminderDate: due.enabled ? shiftDays(dueDate, -due.daysBefore) : undefined,
        sourceId: card._id,
      })
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())
  return events
}

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000 // 台灣 UTC+8，無日光節約

export type DueReminder = { title: string; body: string; url: string }

// 依 now（伺服器 UTC 時間）換算「台灣今天」，回傳今天該發送的提醒通知內容。
// 為處理跨月位移（例如結帳日 31 + N 天落到下月、扣款日 1 - N 天落到上月），
// 對上月／本月／下月都計算事件，再比對提醒日是否為台灣今天。
export function getDueReminders(
  subscriptions: Subscription[],
  cards: Card[],
  now: Date,
): DueReminder[] {
  const taipei = new Date(now.getTime() + TAIPEI_OFFSET_MS)
  const ty = taipei.getUTCFullYear()
  const tm = taipei.getUTCMonth()
  const td = taipei.getUTCDate()

  const months = [-1, 0, 1].map(delta => {
    const d = new Date(ty, tm + delta, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const seen = new Set<string>()
  const out: DueReminder[] = []

  for (const { year, month } of months) {
    for (const ev of getMonthlyEvents(subscriptions, cards, year, month)) {
      const r = ev.reminderDate
      if (!r) continue
      // 以日曆日整數比對（getMonthlyEvents 以本地建構日期，與測試機時區無關）。
      if (r.getFullYear() !== ty || r.getMonth() !== tm || r.getDate() !== td) continue
      const key = `${ev.sourceId}-${ev.kind}-${ev.date.getTime()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(toReminder(ev))
    }
  }

  return out
}

function md(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function toReminder(ev: ScheduleEvent): DueReminder {
  if (ev.kind === 'charge') {
    const amount = ev.amount != null ? ` $${Math.floor(ev.amount)} ${ev.currency ?? ''}`.trimEnd() : ''
    return { title: `扣款提醒：${ev.title}`, body: `${ev.title} 將於 ${md(ev.date)} 扣款${amount}`, url: '/' }
  }
  if (ev.kind === 'statement') {
    return { title: `可繳費提醒：${ev.title}`, body: `${ev.title} 已結帳，可以開始繳費了`, url: '/' }
  }
  return { title: `繳費提醒：${ev.title}`, body: `${ev.title} 將於 ${md(ev.date)} 繳費到期`, url: '/' }
}
