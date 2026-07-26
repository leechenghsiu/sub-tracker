import type { Subscription, Card, ScheduleEvent, Reminder } from '@/components/types'

const DEFAULT_REMINDER: Reminder = { enabled: false, daysBefore: 1 }

// 回傳指定年月中「幾號」對應的實際日期；若超過當月天數，取當月最後一天。
export function resolveDayInMonth(day: number, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
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
    events.push({
      date: resolveDayInMonth(day, year, month),
      kind: 'charge',
      title: sub.name,
      category: sub.category ?? 'subscription',
      amount: sub.price,
      currency: sub.currency,
      reminder: sub.reminder ?? DEFAULT_REMINDER,
      sourceId: sub._id,
    })
  }

  for (const card of cards) {
    if (card.deletedAt) continue
    events.push({
      date: resolveDayInMonth(card.statementDay, year, month),
      kind: 'statement',
      title: card.name,
      cardName: card.name,
      reminder: card.reminder ?? DEFAULT_REMINDER,
      sourceId: card._id,
    })
    events.push({
      date: resolveDayInMonth(card.dueDay, year, month),
      kind: 'due',
      title: card.name,
      cardName: card.name,
      reminder: card.reminder ?? DEFAULT_REMINDER,
      sourceId: card._id,
    })
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())
  return events
}
