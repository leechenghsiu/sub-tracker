# 財務日程整合 Implementation Plan（第一階段）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把信用卡（結帳日/繳費日）、投資與固定支出（房租等）納入 SubTracker，並提供統一的「本月財務日程」視圖；每筆項目與每張卡都能儲存提醒設定（發送留待第二階段）。

**Architecture:** 沿用現有 `subscription` collection，加 `category` 與 `reminder` 兩欄；信用卡獨立成新的 `card` collection。日程計算為 `app/lib/schedule.ts` 的純函式（可單元測試）。前端主 tab 由 2 個擴充為 3 個（日程 / 定期項目 / 代墊項目）。

**Tech Stack:** Next.js 15（App Router）、MongoDB 原生 driver、TypeScript、Tailwind、Radix UI、date-fns、vitest（本計畫新增，測純函式）。

## Global Constraints

- 所有 API 路由沿用現有授權慣例：`verifyAuth(req)`（Bearer JWT，密鑰 `process.env.PASSWORD`），未授權回 `NextResponse.json({ error: '未授權' }, { status: 401 })`。
- 資料庫存取一律用 `getDb()`（來自 `@/app/lib/mongo`），資料庫名 `subtracker`。
- 刪除一律軟刪除：`{ $set: { deletedAt: new Date() } }`；查詢一律 `{ deletedAt: null }`。
- 向後相容：舊 `subscription` 文件無 `category` 時視為 `'subscription'`；無 `reminder` 時視為 `{ enabled: false, daysBefore: 1 }`。不做破壞性資料庫遷移。
- `category` 僅三值：`'subscription' | 'investment' | 'expense'`。
- UI 文案用繁體中文，沿用現有元件（`@/components/ui/*`）與風格。
- 每個任務結束時 `npx tsc --noEmit`（型別檢查）與 `npm run lint` 應通過。

---

### Task 1: 測試框架 + 型別擴充

**Files:**
- Modify: `package.json`（加 vitest 與 test script）
- Create: `vitest.config.ts`
- Modify: `components/types.ts`

**Interfaces:**
- Produces: 型別 `Reminder`、`Card`、`ScheduleEvent`；`Subscription` 新增 `category?`、`reminder?`。後續任務都會 import 這些型別。
- Produces: `npm test` 可執行 vitest。

- [ ] **Step 1: 安裝 vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: 建立 vitest 設定**

Create `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
```

- [ ] **Step 3: 加入 test script**

在 `package.json` 的 `scripts` 加一行（放在 `"lint"` 之後）：

```json
"test": "vitest run"
```

- [ ] **Step 4: 擴充型別**

在 `components/types.ts` 最上方加入新型別，並替 `Subscription` 加兩個欄位。新增內容：

```ts
export type Reminder = {
  enabled: boolean;
  daysBefore: number;
};

export type Category = 'subscription' | 'investment' | 'expense';

export type Card = {
  _id: string;
  name: string;
  last4?: string;
  statementDay: number; // 每月幾號 1-31
  dueDay: number;       // 每月幾號 1-31
  color?: string;
  note?: string;
  reminder: Reminder;
  createdAt: string;
  deletedAt: string | null;
};

export type ScheduleEvent = {
  date: Date;
  kind: 'charge' | 'statement' | 'due';
  title: string;
  category?: Category;
  amount?: number;
  currency?: string;
  cardName?: string;
  reminder: Reminder;
  sourceId: string;
};
```

在 `Subscription` type 內（`isAdvance` 附近）加入：

```ts
  category?: Category;
  reminder?: Reminder;
```

- [ ] **Step 5: 型別檢查通過**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts components/types.ts
git commit -m "chore: add vitest and card/reminder/schedule types"
```

---

### Task 2: 日程計算純函式（TDD）

**Files:**
- Create: `app/lib/schedule.ts`
- Test: `app/lib/schedule.test.ts`

**Interfaces:**
- Consumes: 型別 `Subscription`、`Card`、`ScheduleEvent`、`Reminder`（Task 1）。
- Produces:
  - `resolveDayInMonth(day: number, year: number, month: number): Date`（`month` 為 0–11；`day` 超過當月天數取最後一天）
  - `isChargeInMonth(billingDate: string, cycle: string, year: number, month: number): boolean`
  - `getMonthlyEvents(subscriptions: Subscription[], cards: Card[], year: number, month: number): ScheduleEvent[]`（依 `date` 升冪排序）

- [ ] **Step 1: 寫失敗測試**

Create `app/lib/schedule.test.ts`：

```ts
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test`
Expected: FAIL（`./schedule` 尚未建立 / 函式未定義）

- [ ] **Step 3: 實作純函式**

Create `app/lib/schedule.ts`：

```ts
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test`
Expected: PASS（全部）

- [ ] **Step 5: Commit**

```bash
git add app/lib/schedule.ts app/lib/schedule.test.ts
git commit -m "feat: add monthly schedule computation with tests"
```

---

### Task 3: 信用卡 API 路由

**Files:**
- Create: `app/api/card/route.ts`
- Create: `app/api/card/[id]/route.ts`

**Interfaces:**
- Produces: `GET /api/card`（列出未刪除卡片）、`POST /api/card`（新增）、`DELETE /api/card`（body `{ id }`，軟刪除）、`PATCH /api/card/[id]`（更新單張卡）。
- 卡片文件形狀符合 Task 1 的 `Card` 型別。

- [ ] **Step 1: 建立 card 集合路由**

Create `app/api/card/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/app/lib/mongo'
import { ObjectId } from 'mongodb'

const PASSWORD = process.env.PASSWORD || ''

function verifyAuth(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  try {
    return jwt.verify(token, PASSWORD)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const cards = await db.collection('card').find({ deletedAt: null }).sort({ createdAt: -1 }).toArray()
    return NextResponse.json(cards || [])
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const data = await req.json()
    const doc = {
      name: data.name,
      last4: data.last4 || '',
      statementDay: parseInt(data.statementDay, 10),
      dueDay: parseInt(data.dueDay, 10),
      color: data.color || '',
      note: data.note || '',
      reminder: {
        enabled: !!data.reminder?.enabled,
        daysBefore: Number(data.reminder?.daysBefore ?? 1),
      },
      createdAt: new Date(),
      deletedAt: null,
    }
    const result = await db.collection('card').insertOne(doc)
    return NextResponse.json({ ...doc, _id: result.insertedId })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const { id } = await req.json()
    const result = await db.collection('card').updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date() } }
    )
    return NextResponse.json({ success: result.modifiedCount === 1 })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 建立單卡更新路由**

Create `app/api/card/[id]/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/app/lib/mongo'
import { ObjectId } from 'mongodb'

const PASSWORD = process.env.PASSWORD || ''

function verifyAuth(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  try {
    return jwt.verify(token, PASSWORD)
  } catch {
    return null
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const { id } = await context.params
    const data = await req.json()
    const update: Record<string, unknown> = {}
    for (const key of ['name', 'last4', 'color', 'note']) {
      if (key in data) update[key] = data[key]
    }
    if ('statementDay' in data) update.statementDay = parseInt(data.statementDay, 10)
    if ('dueDay' in data) update.dueDay = parseInt(data.dueDay, 10)
    if ('reminder' in data) {
      update.reminder = {
        enabled: !!data.reminder?.enabled,
        daysBefore: Number(data.reminder?.daysBefore ?? 1),
      }
    }
    await db.collection('card').updateOne({ _id: new ObjectId(id) }, { $set: update })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}
```

- [ ] **Step 3: 型別檢查與 lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤

- [ ] **Step 4: 手動驗證（需 dev server 與有效 token）**

Run: `npm run dev`（另開終端機）
先登入取得 token（瀏覽器 localStorage 的 `token`），再驗證：

```bash
TOKEN="<貼上 token>"
# 新增
curl -s -X POST localhost:3000/api/card -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"CUBE","statementDay":5,"dueDay":22,"reminder":{"enabled":true,"daysBefore":3}}'
# 列出
curl -s localhost:3000/api/card -H "Authorization: Bearer $TOKEN"
```
Expected: POST 回傳含 `_id` 的卡片；GET 陣列包含該卡。未帶 token 時回 401。

- [ ] **Step 5: Commit**

```bash
git add app/api/card
git commit -m "feat: add card CRUD API routes"
```

---

### Task 4: 訂閱 API 加入 category 與 reminder

**Files:**
- Modify: `app/api/subscription/route.ts`
- Modify: `app/api/subscription/[id]/route.ts`（PATCH 需保留 category/reminder，見下）

**Interfaces:**
- Consumes: 現有 `verifyAuth`、`getDb`、`getExchangeRates`。
- Produces: `GET /api/subscription` 每筆帶 `category`（缺省 `'subscription'`）與 `reminder`（缺省 `{ enabled: false, daysBefore: 1 }`）；`POST` 儲存這兩欄。

- [ ] **Step 1: GET 補預設值**

在 `app/api/subscription/route.ts` 的 `GET` 內，`withTWD` 的 `map` 回傳物件加上兩欄（在 `return { ...sub, twdAmount }` 改為）：

```ts
      return {
        ...sub,
        twdAmount,
        category: sub.category ?? 'subscription',
        reminder: sub.reminder ?? { enabled: false, daysBefore: 1 },
      };
```

- [ ] **Step 2: POST 儲存新欄位**

在同檔 `POST` 的 `doc` 物件加入（在 `deletedAt: null` 前）：

```ts
      category: data.category || 'subscription',
      reminder: {
        enabled: !!data.reminder?.enabled,
        daysBefore: Number(data.reminder?.daysBefore ?? 1),
      },
```

- [ ] **Step 3: 確認 PATCH 不會抹掉新欄位**

檢視 `app/api/subscription/[id]/route.ts` 的 `PATCH`。現有實作以 `$set` 更新傳入的欄位。編輯表單送出 `...form` 時已含 `category`/`reminder`（Task 6 會補進編輯表單），故無需改動；若該檔 PATCH 對欄位有白名單，將 `category`、`reminder` 加入白名單。若為整份 `$set: form`，確認不會因缺欄位而覆蓋——本任務只需確認，不需改碼。

- [ ] **Step 4: 型別檢查與 lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤

- [ ] **Step 5: 手動驗證**

Run: `npm run dev`
```bash
TOKEN="<token>"
curl -s -X POST localhost:3000/api/subscription -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"元大0050","price":3000,"currency":"TWD","billingDate":"2026-07-08","cycle":"monthly","category":"investment","reminder":{"enabled":true,"daysBefore":2},"selfRatio":1,"advanceRatio":1,"isAdvance":false}'
curl -s localhost:3000/api/subscription -H "Authorization: Bearer $TOKEN" | grep -o '"category":"[a-z]*"'
```
Expected: 新項目 `category` 為 `investment`；既有舊項目查詢結果 `category` 為 `subscription`（預設）。

- [ ] **Step 6: Commit**

```bash
git add app/api/subscription
git commit -m "feat: persist category and reminder on subscriptions"
```

---

### Task 5: 新增表單加入「分類」與「提醒」欄位

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `POST /api/subscription`（Task 4）接受 `category`、`reminder`。
- Produces: 新增訂閱/項目時可選分類（訂閱/投資/固定支出）與提醒（開關 + 提前天數），並送進 POST body。

- [ ] **Step 1: 擴充 form state**

在 `app/page.tsx` 的 `useState` 初始 `form` 物件（約 line 171）加入三個欄位：

```ts
    category: "subscription",
    reminderEnabled: false,
    reminderDaysBefore: "1",
```

同步在兩處重設 form 的地方（`handleAdd` 成功後、Dialog `onOpenChange` 關閉時，約 line 298 與 line 395）把這三欄一併重設回上述初始值，避免殘留。

- [ ] **Step 2: POST body 帶上新欄位**

在 `handleAdd` 的 `body` 物件（約 line 274）加入：

```ts
        category: form.category,
        reminder: {
          enabled: form.reminderEnabled,
          daysBefore: Number(form.reminderDaysBefore) || 1,
        },
```

- [ ] **Step 3: Dialog 加入分類選擇與提醒欄位**

在新增 Dialog 的表單內、「週期」區塊之後、「備註」之前，插入分類與提醒兩區塊：

```tsx
                <div>
                  <label className="block mb-1 text-sm font-medium">分類</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription">訂閱</SelectItem>
                      <SelectItem value="investment">投資</SelectItem>
                      <SelectItem value="expense">固定支出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="reminder" checked={form.reminderEnabled} onCheckedChange={v => setForm(f => ({ ...f, reminderEnabled: !!v }))} />
                    <label htmlFor="reminder" className="text-sm select-none cursor-pointer">到期前提醒</label>
                  </div>
                  {form.reminderEnabled && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">提前</span>
                      <Input type="number" inputMode="numeric" min={0} className="w-20"
                        value={form.reminderDaysBefore}
                        onChange={e => setForm(f => ({ ...f, reminderDaysBefore: e.target.value }))} />
                      <span className="text-sm text-muted-foreground">天</span>
                    </div>
                  )}
                </div>
```

（`Select`、`SelectContent`、`SelectItem`、`SelectTrigger`、`SelectValue`、`Checkbox`、`Input` 已在 `page.tsx` import，無需新增。）

- [ ] **Step 4: 型別檢查與 lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤

- [ ] **Step 5: 手動驗證**

Run: `npm run dev`，登入後點「新增訂閱」：
- 確認出現「分類」下拉（訂閱/投資/固定支出）與「到期前提醒」開關；勾選後出現「提前 N 天」。
- 新增一筆分類=投資、提醒開啟的項目，重新整理後於 `GET /api/subscription` 確認欄位已存。

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add category and reminder fields to add form"
```

---

### Task 6: 定期項目總覽依 category 分組 + 編輯表單支援分類

**Files:**
- Modify: `components/OverviewTabs.tsx`
- Modify: `components/SubscriptionList.tsx`

**Interfaces:**
- Consumes: `Subscription.category`（Task 1/4）。
- Produces: 「定期項目」tab 內以分類分區顯示（訂閱/投資/固定支出各一段），編輯 Dialog 內可改分類。

- [ ] **Step 1: 分類分區顯示**

在 `components/OverviewTabs.tsx`，把三個 `TabsContent` 內單一的 `<SubscriptionList .../>` 改為依 category 分三段渲染。於檔案上方加一個常數與小工具，並改寫 `TabsContent`：

```tsx
const CATEGORY_LABELS: Record<string, string> = {
  subscription: '訂閱',
  investment: '投資',
  expense: '固定支出',
};
const CATEGORY_ORDER = ['subscription', 'investment', 'expense'] as const;
```

抽出一個 render 函式（放在 component 內、`return` 前）：

```tsx
  const renderByCategory = (mode: 'monthly' | 'halfyear' | 'yearly') => (
    <div className="space-y-6">
      {CATEGORY_ORDER.map(cat => {
        const list = subscriptions.filter(s => (s.category ?? 'subscription') === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat}>
            <div className="text-sm font-semibold text-muted-foreground mb-2">{CATEGORY_LABELS[cat]}</div>
            <SubscriptionList subscriptions={list} mode={mode} token={token} onRefresh={onRefresh} onUnauthorized={onUnauthorized} />
          </div>
        );
      })}
    </div>
  );
```

把三個 `TabsContent` 內容換成 `{renderByCategory('monthly')}` 等對應 mode。`TotalAmount` 維持吃全部 `subscriptions`（合計不分類）。

- [ ] **Step 2: 編輯 Dialog 加入分類選擇**

在 `components/SubscriptionList.tsx` 詳情/編輯表單的「週期」欄位之後，加入分類欄位（沿用 `Input` 呈現，維持該檔既有 disabled/editMode 模式一致）：

```tsx
                <div>
                  <label className="block mb-1 text-sm font-medium">分類</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-60"
                    value={editMode && form ? (form.category ?? 'subscription') : (selected.category ?? 'subscription')}
                    onChange={e => editMode && form && setForm({ ...form, category: e.target.value as Subscription['category'] })}
                    disabled={!editMode}
                  >
                    <option value="subscription">訂閱</option>
                    <option value="investment">投資</option>
                    <option value="expense">固定支出</option>
                  </select>
                </div>
```

（用原生 `select` 以最小改動；`handleSave` 已送出 `...form`，故 `category` 會一併 PATCH。）

- [ ] **Step 3: 型別檢查與 lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤

- [ ] **Step 4: 手動驗證**

Run: `npm run dev`：
- 於「個人訂閱」tab 確認項目依「訂閱/投資/固定支出」分段顯示，空的分類不顯示。
- 開一筆項目詳情 → 編輯 → 改分類 → 儲存 → 該項目移到對應分段。

- [ ] **Step 5: Commit**

```bash
git add components/OverviewTabs.tsx components/SubscriptionList.tsx
git commit -m "feat: group subscriptions by category and allow editing category"
```

---

### Task 7: 信用卡管理 UI

**Files:**
- Create: `components/CardManager.tsx`
- Modify: `app/page.tsx`（抓取 cards、傳入）

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/card`、`PATCH /api/card/[id]`（Task 3）；型別 `Card`（Task 1）。
- Produces: `<CardManager cards token onRefresh onUnauthorized />` 元件，列出卡片並可新增/刪除/編輯（含結帳日、繳費日、提醒）。同時 `app/page.tsx` 提供 `cards` state 與 `fetchCards`。

- [ ] **Step 1: page.tsx 抓取卡片**

在 `app/page.tsx` 加入 state 與抓取函式（放在 `subscriptions` state 附近）：

```ts
  const [cards, setCards] = useState<Card[]>([]);
```

（於檔案上方 import 加 `Card`：`import { Subscription } from "../components/types";` 改為 `import { Subscription, Card } from "../components/types";`）

加入抓取函式（放在 `fetchSubscriptions` 之後）：

```ts
  async function fetchCards(token: string) {
    try {
      const res = await fetch("/api/card", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) setCards(await res.json());
    } catch {}
  }
```

在原本呼叫 `fetchSubscriptions(savedToken)` 與登入成功 `fetchSubscriptions(data.token)` 之後，各加一行 `fetchCards(...)` 對應 token。

- [ ] **Step 2: 建立 CardManager 元件**

Create `components/CardManager.tsx`：

```tsx
import React, { useState } from "react";
import { Card as CardType } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Plus, Trash2, CreditCard } from "lucide-react";

interface Props {
  cards: CardType[];
  token: string;
  onRefresh: () => void;
  onUnauthorized: () => void;
}

const emptyForm = { name: "", last4: "", statementDay: "1", dueDay: "15", note: "", reminderEnabled: false, reminderDaysBefore: "3" };

export default function CardManager({ cards, token, onRefresh, onUnauthorized }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          last4: form.last4,
          statementDay: form.statementDay,
          dueDay: form.dueDay,
          note: form.note,
          reminder: { enabled: form.reminderEnabled, daysBefore: Number(form.reminderDaysBefore) || 1 },
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) { setForm(emptyForm); setOpen(false); onRefresh(); }
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/card", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) onRefresh();
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold text-muted-foreground">信用卡</div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />新增卡片</Button>
      </div>
      {cards.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">尚未新增信用卡</div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {cards.map(card => (
            <div key={card._id} className="flex items-center px-4 py-3 gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{card.name}{card.last4 && ` ****${card.last4}`}</div>
                <div className="text-xs text-muted-foreground mt-0.5">結帳 {card.statementDay} 號 · 繳費 {card.dueDay} 號</div>
              </div>
              <button type="button" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleDelete(card._id)} aria-label="刪除">
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(emptyForm); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增信用卡</DialogTitle></DialogHeader>
          <form className="flex flex-col gap-4 mt-4" onSubmit={handleAdd}>
            <div>
              <label className="block mb-1 text-sm font-medium">卡片名稱</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例：國泰 CUBE" required />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">末四碼（可選）</label>
              <Input value={form.last4} onChange={e => setForm(f => ({ ...f, last4: e.target.value }))} maxLength={4} inputMode="numeric" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium">結帳日</label>
                <Input type="number" min={1} max={31} value={form.statementDay} onChange={e => setForm(f => ({ ...f, statementDay: e.target.value }))} required />
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium">繳費日</label>
                <Input type="number" min={1} max={31} value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} required />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Checkbox id="card-reminder" checked={form.reminderEnabled} onCheckedChange={v => setForm(f => ({ ...f, reminderEnabled: !!v }))} />
                <label htmlFor="card-reminder" className="text-sm select-none cursor-pointer">到期前提醒</label>
              </div>
              {form.reminderEnabled && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">提前</span>
                  <Input type="number" min={0} className="w-20" value={form.reminderDaysBefore} onChange={e => setForm(f => ({ ...f, reminderDaysBefore: e.target.value }))} />
                  <span className="text-sm text-muted-foreground">天</span>
                </div>
              )}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">備註</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="備註 (可選)" />
            </div>
            <Button type="submit" className="mt-2" disabled={loading}>{loading ? "新增中..." : "新增卡片"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: 型別檢查與 lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤

- [ ] **Step 4: 手動驗證（暫時掛載）**

尚未有「日程」tab，暫時在 `app/page.tsx` 主內容區 `subscriptions` 分支上方臨時渲染 `<CardManager cards={cards} token={token!} onRefresh={() => fetchCards(token!)} onUnauthorized={handleLogout} />` 驗證新增/刪除後清單即時更新，確認無誤後移除臨時掛載（Task 8 會正式放進日程 tab）。

- [ ] **Step 5: Commit**

```bash
git add components/CardManager.tsx app/page.tsx
git commit -m "feat: add credit card management UI and fetching"
```

---

### Task 8: 日程 tab（統一日程視圖）

**Files:**
- Create: `components/ScheduleView.tsx`
- Modify: `app/page.tsx`（新增第三個主 tab 並掛載）

**Interfaces:**
- Consumes: `getMonthlyEvents`（Task 2）、`Subscription`/`Card`/`ScheduleEvent` 型別、`<CardManager>`（Task 7）。
- Produces: 「日程」tab，顯示可切換月份的事件清單，並內含信用卡管理。

- [ ] **Step 1: 建立 ScheduleView 元件**

Create `components/ScheduleView.tsx`：

```tsx
import React, { useState } from "react";
import { Subscription, Card as CardType } from "./types";
import { getMonthlyEvents } from "@/app/lib/schedule";
import { formatNumberWithCommas } from "@/lib/utils";
import CardManager from "./CardManager";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Wallet, CreditCard, Receipt } from "lucide-react";

interface Props {
  subscriptions: Subscription[];
  cards: CardType[];
  token: string;
  onRefreshCards: () => void;
  onUnauthorized: () => void;
}

const KIND_LABEL: Record<string, string> = { charge: "扣款", statement: "結帳", due: "繳費" };
const CATEGORY_LABEL: Record<string, string> = { subscription: "訂閱", investment: "投資", expense: "固定支出" };

export default function ScheduleView({ subscriptions, cards, token, onRefreshCards, onUnauthorized }: Props) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const events = getMonthlyEvents(subscriptions, cards, ym.year, ym.month);

  function shiftMonth(delta: number) {
    setYm(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="上個月"><ChevronLeft className="w-5 h-5" /></Button>
        <div className="font-semibold">{ym.year} 年 {ym.month + 1} 月</div>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="下個月"><ChevronRight className="w-5 h-5" /></Button>
      </div>

      {events.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">本月沒有排定的財務事件</div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {events.map((ev, i) => (
            <div key={`${ev.sourceId}-${ev.kind}-${i}`} className="flex items-center px-4 py-3 gap-3">
              <div className="w-10 text-center">
                <div className="text-lg font-bold leading-none">{ev.date.getDate()}</div>
                <div className="text-[10px] text-muted-foreground">{ev.date.getMonth() + 1}月</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-1.5">
                  {ev.kind === "charge" ? <Wallet className="w-4 h-4 text-muted-foreground" /> : ev.kind === "statement" ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Receipt className="w-4 h-4 text-muted-foreground" />}
                  {ev.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {KIND_LABEL[ev.kind]}
                  {ev.category && ` · ${CATEGORY_LABEL[ev.category] ?? ""}`}
                  {ev.reminder?.enabled && ` · 提前 ${ev.reminder.daysBefore} 天提醒`}
                </div>
              </div>
              {ev.kind === "charge" && ev.amount != null && (
                <div className="text-base font-bold whitespace-nowrap">${formatNumberWithCommas(Math.floor(ev.amount))} {ev.currency}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <CardManager cards={cards} token={token} onRefresh={onRefreshCards} onUnauthorized={onUnauthorized} />
    </div>
  );
}
```

- [ ] **Step 2: page.tsx 新增第三個主 tab**

在 `app/page.tsx`：

1. 把 `mainTab` state 型別擴充為三值（約 line 189）：

```ts
  const [mainTab, setMainTab] = useState<'schedule' | 'subscriptions' | 'splitbills'>('subscriptions');
```

2. 主 tab 的 `TabsList` 改為 `grid-cols-3` 並新增觸發（約 line 375）。在原本兩個 `TabsTrigger` 前插入：

```tsx
            <TabsTrigger value="schedule"><CalendarIcon className="w-4 h-4 mr-1.5" />日程</TabsTrigger>
```
並把 `TabsList` 的 `grid-cols-2` 改為 `grid-cols-3`；`onValueChange` 的型別 cast 改為 `v as 'schedule' | 'subscriptions' | 'splitbills'`。

3. 「新增」按鈕列：當 `mainTab === 'schedule'` 時隱藏（日程 tab 的新增動作由卡片管理自行提供）。把該 `<div className="flex justify-end">` 包一層條件 `{mainTab !== 'schedule' && (...)}`。

4. 主內容區（約 line 539）在最前面加入 schedule 分支：

```tsx
        ) : mainTab === 'schedule' ? (
          <ScheduleView subscriptions={subscriptions} cards={cards} token={token!} onRefreshCards={() => fetchCards(token!)} onUnauthorized={handleLogout} />
        ) : mainTab === 'subscriptions' ? (
```
（即在現有的 `dataLoading ? <Skeleton/> : mainTab === 'subscriptions' ? ...` 條件鏈中插入 schedule 分支。）

5. 於 import 區加入：`import ScheduleView from "../components/ScheduleView";`。移除 Task 7 Step 4 的臨時 `CardManager` 掛載（若尚未移除）。

- [ ] **Step 3: 型別檢查與 lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤

- [ ] **Step 4: 手動驗證**

Run: `npm run dev`：
- 出現三個主 tab：日程 / 個人訂閱 / 代墊項目。
- 「日程」tab 顯示本月事件（訂閱/投資/固定支出的扣款日 + 卡片結帳/繳費日）依日期排序；可切換上/下月。
- 在日程 tab 下方新增一張卡（結帳 5 號、繳費 22 號），該月日程立即出現兩筆事件。
- 切到有跨月週期（半年/年）的項目，確認只在命中月份出現。

- [ ] **Step 5: 執行單元測試與建置**

Run: `npm test && npm run build`
Expected: 測試全過、build 成功。

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/ScheduleView.tsx
git commit -m "feat: add unified monthly schedule tab"
```

---

## Self-Review

**Spec coverage：**
- `category` 三類（訂閱/投資/固定支出）→ Task 1（型別）、4（API）、5（新增）、6（顯示/編輯）。✅
- `reminder` 欄位只存不發 → Task 1、3、4、5、7。✅
- `card` collection（結帳日/繳費日/月底夾取/軟刪除/不記金額不綁項目）→ Task 1（型別）、2（月底夾取）、3（API）、7（UI）。✅
- 日程計算純函式（monthly/halfyear/yearly 命中、月底夾取、卡片事件、排序）→ Task 2（含測試）。✅
- 前端計算、避免多一次 API → Task 2 純函式 + Task 8 前端呼叫。✅
- UI 三主 tab（日程/定期項目/代墊）→ Task 8（tab）、6（定期項目分組）、代墊維持不動。✅
- 向後相容（舊資料補預設）→ Task 2（純函式 `??`）、Task 4（GET 補值）。✅
- 不在範圍：Web Push / cron / 帳單聚合 → 均未納入任務，留待第二階段。✅

**Placeholder scan：** 無 TBD/TODO；所有程式碼步驟均含實際內容。✅

**Type consistency：** `getMonthlyEvents`/`resolveDayInMonth`/`isChargeInMonth` 簽章在 Task 2 定義並於 Task 8 使用一致；`Card`/`Reminder`/`ScheduleEvent`/`Category` 於 Task 1 定義後各任務沿用；`reminder` 形狀 `{ enabled, daysBefore }` 全程一致。✅

## 注意事項（給執行者）

- `app/api/subscription/[id]/route.ts` 的 PATCH 目前實作需在 Task 4 Step 3 檢視；若它以欄位白名單更新，務必把 `category`、`reminder` 加入，否則編輯項目會抹掉分類/提醒。
- 匯率換算：日程事件金額（Task 8）直接顯示項目原幣別金額，未做台幣換算與週期換算（YAGNI）；總覽（TotalAmount）維持既有換算邏輯不變。
- vitest 的測試僅涵蓋純函式；API 與 UI 以手動步驟驗證（專案無 DB/元件測試基礎設施）。
