import { describe, it, expect } from 'vitest'
import { resolveDayInMonth, isChargeInMonth, getMonthlyEvents, shiftDays, getDueReminders, normalizeDaysBefore } from './schedule'
import type { Subscription, Card } from '@/components/types'

// 以「台灣某日的當地上午 9 點」建構一個 UTC Date（台灣 UTC+8 → 減 8 小時）。
function taipeiMorning(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 9 - 8, 0, 0))
}

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

describe('normalizeDaysBefore', () => {
  it('保留 0（扣款當天提醒）', () => {
    expect(normalizeDaysBefore('0')).toBe(0)
  })
  it('一般天數原樣回傳', () => {
    expect(normalizeDaysBefore('3')).toBe(3)
  })
  it('空字串回退為 1', () => {
    expect(normalizeDaysBefore('')).toBe(1)
  })
  it('非數字回退為 1', () => {
    expect(normalizeDaysBefore('abc')).toBe(1)
  })
  it('負數視為 0（不會提醒到扣款日之後）', () => {
    expect(normalizeDaysBefore('-2')).toBe(0)
  })
  it('小數無條件捨去', () => {
    expect(normalizeDaysBefore('2.7')).toBe(2)
  })
})

describe('shiftDays', () => {
  it('加天數可跨月', () => {
    expect(shiftDays(new Date(2026, 6, 31), 1)).toEqual(new Date(2026, 7, 1))
  })
  it('減天數可跨月', () => {
    expect(shiftDays(new Date(2026, 6, 1), -1)).toEqual(new Date(2026, 5, 30))
  })
})

describe('getMonthlyEvents', () => {
  const sub: Subscription = {
    _id: 's1', name: 'Netflix', price: 390, currency: 'TWD',
    billingDate: '2026-01-05', cycle: 'monthly', createdAt: '', deletedAt: null,
    selfRatio: 1, advanceRatio: 1, isAdvance: false, category: 'subscription',
  }
  const card: Card = {
    _id: 'c1', name: 'CUBE', statementDay: 5, dueDay: 22,
    payReminder: { enabled: true, daysAfter: 1 },
    dueReminder: { enabled: true, daysBefore: 3 },
    createdAt: '', deletedAt: null,
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

  it('可繳費提醒在結帳日隔天觸發（statement + daysAfter）', () => {
    const events = getMonthlyEvents([], [card], 2026, 6)
    const statement = events.find(e => e.kind === 'statement')!
    expect(statement.reminderDate).toEqual(new Date(2026, 6, 6)) // 5 號 + 1
  })

  it('到期前提醒在繳費截止日前 N 天觸發（due - daysBefore）', () => {
    const events = getMonthlyEvents([], [card], 2026, 6)
    const due = events.find(e => e.kind === 'due')!
    expect(due.reminderDate).toEqual(new Date(2026, 6, 19)) // 22 號 - 3
  })

  it('提醒關閉時 reminderDate 為 undefined', () => {
    const off: Card = {
      ...card, _id: 'c2',
      payReminder: { enabled: false, daysAfter: 1 },
      dueReminder: { enabled: false, daysBefore: 3 },
    }
    const events = getMonthlyEvents([], [off], 2026, 6)
    expect(events.every(e => e.reminderDate === undefined)).toBe(true)
  })

  it('向後相容：舊卡片的單一 reminder 視為到期前提醒', () => {
    const legacy = {
      _id: 'c3', name: 'OLD', statementDay: 5, dueDay: 22,
      reminder: { enabled: true, daysBefore: 2 },
      createdAt: '', deletedAt: null,
    } as unknown as Card
    const events = getMonthlyEvents([], [legacy], 2026, 6)
    const due = events.find(e => e.kind === 'due')!
    const statement = events.find(e => e.kind === 'statement')!
    expect(due.reminderDate).toEqual(new Date(2026, 6, 20)) // 22 - 2
    expect(statement.reminderDate).toBeUndefined() // 舊卡無可繳費提醒
  })

  it('未填繳費截止日時只產生結帳事件', () => {
    const noDue: Card = { ...card, _id: 'c4', dueDay: null }
    const events = getMonthlyEvents([], [noDue], 2026, 6)
    expect(events.map(e => e.kind)).toEqual(['statement'])
  })

  it('所有事件依日期升冪排序', () => {
    const events = getMonthlyEvents([sub], [card], 2026, 6)
    const times = events.map(e => e.date.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})

describe('getDueReminders', () => {
  // 扣款日 5 號，提前 1 天提醒 → 提醒日為每月 4 號
  const sub: Subscription = {
    _id: 's1', name: 'Netflix', price: 390, currency: 'TWD',
    billingDate: '2026-01-05', cycle: 'monthly', createdAt: '', deletedAt: null,
    selfRatio: 1, advanceRatio: 1, isAdvance: false, category: 'subscription',
    reminder: { enabled: true, daysBefore: 1 },
  }
  // 結帳日 5 號隔天提醒（6 號）、截止日 22 號前 3 天提醒（19 號）
  const card: Card = {
    _id: 'c1', name: 'CUBE', statementDay: 5, dueDay: 22,
    payReminder: { enabled: true, daysAfter: 1 },
    dueReminder: { enabled: true, daysBefore: 3 },
    createdAt: '', deletedAt: null,
  }

  it('命中扣款提醒日時回傳一則含金額的通知', () => {
    const out = getDueReminders([sub], [], taipeiMorning(2026, 6, 4))
    expect(out).toHaveLength(1)
    expect(out[0].title).toContain('Netflix')
    expect(out[0].body).toContain('7/5')
    expect(out[0].body).toContain('390')
  })

  it('非提醒日時不回傳任何通知', () => {
    expect(getDueReminders([sub], [], taipeiMorning(2026, 6, 10))).toHaveLength(0)
  })

  it('命中可繳費提醒日（結帳隔天）', () => {
    const out = getDueReminders([], [card], taipeiMorning(2026, 6, 6))
    expect(out).toHaveLength(1)
    expect(out[0].body).toContain('可以')
    expect(out[0].title).toContain('CUBE')
  })

  it('命中到期提醒日（截止前 3 天）', () => {
    const out = getDueReminders([], [card], taipeiMorning(2026, 6, 19))
    expect(out).toHaveLength(1)
    expect(out[0].body).toContain('到期')
    expect(out[0].body).toContain('7/22')
  })

  it('daysBefore 為 0 時在扣款當天提醒', () => {
    const sameDay: Subscription = { ...sub, _id: 's4', reminder: { enabled: true, daysBefore: 0 } }
    const out = getDueReminders([sameDay], [], taipeiMorning(2026, 6, 5))
    expect(out).toHaveLength(1)
    expect(out[0].body).toContain('7/5')
  })

  it('daysBefore 為 0 時不會在前一天誤發', () => {
    const sameDay: Subscription = { ...sub, _id: 's5', reminder: { enabled: true, daysBefore: 0 } }
    expect(getDueReminders([sameDay], [], taipeiMorning(2026, 6, 4))).toHaveLength(0)
  })

  it('提醒關閉時不發送', () => {
    const off: Subscription = { ...sub, reminder: { enabled: false, daysBefore: 1 } }
    expect(getDueReminders([off], [], taipeiMorning(2026, 6, 4))).toHaveLength(0)
  })

  it('跨月邊界：扣款日 1 號提前 1 天，提醒落在上月最後一天', () => {
    // 8 月 1 號扣款、提前 1 天 → 提醒日為 7/31
    const monthStart: Subscription = { ...sub, _id: 's2', billingDate: '2026-01-01' }
    const out = getDueReminders([monthStart], [], taipeiMorning(2026, 6, 31))
    expect(out).toHaveLength(1)
    expect(out[0].body).toContain('8/1')
  })

  it('時區：以台灣日期為準（UTC 仍是前一天時不誤發）', () => {
    // 台灣時間 7/4 00:30 = UTC 7/3 16:30，應算 7/4
    const t = new Date(Date.UTC(2026, 6, 3, 16, 30, 0))
    expect(getDueReminders([sub], [], t)).toHaveLength(1)
  })

  it('同時命中多筆時全部回傳', () => {
    // 台灣 7/6：sub 的提醒日是 7/4（不中），card 結帳隔天 7/6（中）
    const sub6: Subscription = { ...sub, _id: 's3', billingDate: '2026-01-07' } // 提醒日 7/6
    const out = getDueReminders([sub6], [card], taipeiMorning(2026, 6, 6))
    expect(out.length).toBe(2)
  })
})
