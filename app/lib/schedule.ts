import type { Subscription, Card, ScheduleEvent, Reminder, PayReminder } from '@/components/types'

const DEFAULT_REMINDER: Reminder = { enabled: false, daysBefore: 1 }
const DEFAULT_PAY_REMINDER: PayReminder = { enabled: false, daysAfter: 1 }

// 回傳指定年月中「幾號」對應的實際日期；若超過當月天數，取當月最後一天。
export function resolveDayInMonth(day: number, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
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
