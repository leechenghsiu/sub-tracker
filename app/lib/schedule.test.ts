import { describe, it, expect } from 'vitest'
import { resolveDayInMonth, isChargeInMonth, getMonthlyEvents } from './schedule'
import type { Subscription, Card } from '@/components/types'

describe('resolveDayInMonth', () => {
  it('回傳當月指定日', () => {
    expect(resolveDayInMonth(15, 2026, 6)).toEqual(new Date(2026, 6, 15))
  })
  it('超過當月天數時取最後一天（31 號遇 2 月）', () => {
    expect(resolveDayInMonth(31, 2026, 1)).toEqual(new Date(2026, 1, 28))
  })
})

describe('isChargeInMonth', () => {
  it('monthly 每月都命中', () => {
    expect(isChargeInMonth('2026-01-10', 'monthly', 2026, 6)).toBe(true)
  })
  it('起始月之前不命中', () => {
    expect(isChargeInMonth('2026-05-10', 'monthly', 2026, 3)).toBe(false)
  })
  it('halfyear 每 6 個月命中一次', () => {
    expect(isChargeInMonth('2026-01-10', 'halfyear', 2026, 6)).toBe(true)  // +6
    expect(isChargeInMonth('2026-01-10', 'halfyear', 2026, 3)).toBe(false) // +3
  })
  it('yearly 每 12 個月命中一次', () => {
    expect(isChargeInMonth('2026-01-10', 'yearly', 2027, 0)).toBe(true)   // +12
    expect(isChargeInMonth('2026-01-10', 'yearly', 2026, 6)).toBe(false)  // +6
  })
})

describe('getMonthlyEvents', () => {
  const reminder = { enabled: false, daysBefore: 1 }
  const sub: Subscription = {
    _id: 's1', name: 'Netflix', price: 390, currency: 'TWD',
    billingDate: '2026-01-05', cycle: 'monthly', createdAt: '', deletedAt: null,
    selfRatio: 1, advanceRatio: 1, isAdvance: false, category: 'subscription',
  }
  const card: Card = {
    _id: 'c1', name: 'CUBE', statementDay: 5, dueDay: 22,
    reminder, createdAt: '', deletedAt: null,
  }

  it('產生扣款事件並帶 category/amount', () => {
    const events = getMonthlyEvents([sub], [], 2026, 6)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: 'charge', title: 'Netflix', category: 'subscription',
      amount: 390, currency: 'TWD', sourceId: 's1',
    })
    expect(events[0].date).toEqual(new Date(2026, 6, 5))
  })

  it('每張卡產生結帳與繳費兩個事件', () => {
    const events = getMonthlyEvents([], [card], 2026, 6)
    expect(events.map(e => e.kind)).toEqual(['statement', 'due'])
    expect(events[0].date).toEqual(new Date(2026, 6, 5))
    expect(events[1].date).toEqual(new Date(2026, 6, 22))
  })

  it('所有事件依日期升冪排序', () => {
    const events = getMonthlyEvents([sub], [card], 2026, 6)
    const times = events.map(e => e.date.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})
