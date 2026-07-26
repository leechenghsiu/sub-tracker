# 財務日程整合設計（第一階段：資料模型 + 日程）

日期：2026-07-26
狀態：待實作

## 背景與目標

SubTracker 目前是 Next.js 15 全端（MongoDB 直連）的單人 App，所有項目存在同一個
`subscription` collection，用 `isAdvance` 旗標區分「個人訂閱」與「代墊項目」兩個主 tab。

使用者希望把三種財務事件統一納入管理，並最終能收到手機提醒（PWA Web Push）：

1. **信用卡結帳日 / 繳費日**
2. **定期扣款**（現有訂閱、投資定期定額、房租等固定支出）
3. 全部項目都能設定提醒

本專案切成兩個獨立子專案，本 spec 只涵蓋**第一階段：資料模型 + 日程視圖**。
第二階段（Web Push 推播 + 後端排程）另立 spec，因為它獨立且複雜，且需要第一階段的資料先到位。

## 核心設計洞察

- **投資扣款、房租等，在結構上與訂閱相同**：都是「有金額、有日期、有週期」的定期扣款。
  差別只是**分類**。→ 沿用現有 `subscription` 結構，加一個 `category` 欄位區分即可。
- **信用卡結帳日本質不同**：金額每月浮動，重點在「日期」而非固定金額。
  → 獨立成新的 `card` collection。
- 提醒是所有這些事件的共通需求 → 每筆項目/每張卡都帶一個 `reminder` 設定欄位，
  本階段只儲存，第二階段推播直接讀取消費。

## 資料模型

### A. `subscription` collection：新增兩個欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `category` | `'subscription' \| 'investment' \| 'expense'` | 訂閱／投資／固定支出。房租、水電、保險、貸款歸 `expense` |
| `reminder` | `{ enabled: boolean, daysBefore: number }` | 提醒設定，本階段只存不發 |

- **向後相容**：舊資料沒有 `category` 時，讀取端一律視為 `'subscription'`。
  不做破壞性資料庫遷移；以讀取時套用預設值處理。
- 舊資料沒有 `reminder` 時，視為 `{ enabled: false, daysBefore: 1 }`。
- 其餘欄位（`name`、`price`、`currency`、`billingDate`、`cycle`、`isAdvance`、
  `selfRatio`、`advanceRatio`、`note`、`records`、`settlements`…）完全不變。
- `isAdvance`（代墊）與 `category` 正交：任何分類都可以有代墊（雖然投資通常不會）。

### B. `card` collection：新增

```ts
{
  _id: ObjectId,
  name: string,          // 卡名，例：「國泰 CUBE」
  last4?: string,        // 末四碼（可選）
  statementDay: number,  // 結帳日，每月幾號 1–31
  dueDay: number,        // 繳費日，每月幾號 1–31
  color?: string,        // 顏色標記（可選）
  note?: string,
  reminder: { enabled: boolean, daysBefore: number },
  createdAt: Date,
  deletedAt: Date | null // 沿用軟刪除慣例
}
```

- `statementDay` / `dueDay` 用「每月幾號」而非完整日期，因為信用卡每月循環。
- **月底日處理**：若某月沒有該號（如 31 號遇上 2 月），自動取當月最後一天。
- 第一版卡片**不記金額、不綁定任何項目**（YAGNI）。
  未來要做「帳單金額自動聚合」時，只要在 `subscription` 項目加 `cardId` 即可升級，
  本設計不預先實作。

## 日程計算

提供一個函式：給定年月 `(year, month)`，回傳該月所有財務事件、依日期排序的清單。

事件來源：
1. **定期項目**（所有未刪除的 `subscription` 文件）的本月扣款日：
   - `cycle === 'monthly'`：每月都有，日期取 `billingDate` 的「日」。
   - `cycle === 'halfyear'`：從 `billingDate` 起算，每 6 個月一次，判斷目標月份是否命中。
   - `cycle === 'yearly'`：從 `billingDate` 起算，每 12 個月一次，判斷目標月份是否命中。
   - 「日」若超過該月天數，取當月最後一天。
2. **每張卡**（所有未刪除的 `card` 文件）的結帳日與繳費日（各一個事件）。

每個事件的形狀（供 UI 與未來推播共用）：

```ts
{
  date: Date,                    // 該月的實際日期
  kind: 'charge' | 'statement' | 'due',
  title: string,                // 項目名 / 卡名
  category?: 'subscription' | 'investment' | 'expense',  // charge 才有
  amount?: number,              // charge 才有（換算後的顯示金額）
  currency?: string,
  cardName?: string,            // statement / due 才有
  reminder: { enabled: boolean, daysBefore: number },
  sourceId: string,             // 對應的 subscription / card _id
}
```

計算放在**前端**（`app/lib` 內的純函式），輸入為已抓下來的 subscriptions + cards。
理由：資料量小、換算率已在前端可得、避免新增 API 往返；亦便於單元測試。

## API 變更

- `GET /api/subscription`：回傳結果額外帶出 `category`（缺省補 `'subscription'`）與 `reminder`。
- `POST /api/subscription`：接受並儲存 `category`、`reminder`。
- 新增 `app/api/card/route.ts`：
  - `GET`：列出未刪除卡片。
  - `POST`：新增卡片。
  - `DELETE`：軟刪除（`deletedAt`）。
- 新增 `app/api/card/[id]/route.ts`：`PATCH`/`PUT` 編輯單張卡片（如需要）。
- 所有 card 路由沿用現有 `verifyAuth`（Bearer JWT）與 `getDb()` 慣例。

## UI 調整

主 tab 由現在的 2 個（個人訂閱、代墊項目）調整為 3 個：

1. **日程**（新）
   - 本月所有事件的時間軸清單，依日期排序，區分扣款／結帳／繳費三種。
   - 可切換月份。
   - 信用卡的新增／編輯／刪除入口放這個 tab。
2. **定期項目**（原「個人訂閱」擴充）
   - 用 `category` 分組顯示：訂閱／投資／固定支出。
   - 總覽分別統計每類金額與合計（沿用現有幣別/週期換算邏輯）。
   - 新增/編輯項目的表單加上「分類」選擇。
3. **代墊項目**（維持現狀，不動）

新增/編輯項目與卡片的表單，都加上「提醒」區塊：開關 + 提前天數（`daysBefore`）。

> UI 佈局是本階段最可再調整的部分；資料模型與日程計算為較穩定的核心。

## 不在本階段範圍（第二階段另立 spec）

- Web Push service worker、VAPID 金鑰、推播訂閱儲存。
- 後端排程（cron）依 `reminder.daysBefore` 在到期前發送通知。
- 信用卡帳單金額自動聚合（項目綁卡）。

## 測試策略

- 日程計算純函式的單元測試：
  - monthly / halfyear / yearly 的命中判斷。
  - 月底日（31 號遇 2 月、小月）取當月最後一天。
  - 卡片結帳日/繳費日事件產生正確。
- API 路由：card CRUD 的授權與軟刪除行為。
- 向後相容：舊 subscription 文件（無 `category` / `reminder`）讀取後補上預設值。
