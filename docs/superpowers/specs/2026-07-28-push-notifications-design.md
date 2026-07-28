# Phase 2：Web Push 推播通知 — 設計

日期：2026-07-28
狀態：已核准，進實作

## 目標

在既有「財務日程」功能上，把已計算好的提醒（`reminderDate`）真正變成手機推播通知。使用者一律以 PWA（加入主畫面）方式使用。

## 架構總覽

```
[使用者裝置 PWA] --開啟通知--> requestPermission + pushManager.subscribe
       |                                    |
       |  存 subscription                    v
       +------------------------> POST /api/push/subscribe --> MongoDB: pushSubscription

[外部 cron 每天 09:00 台灣時間] --帶 CRON_SECRET--> GET /api/cron/reminders
       |                                                        |
       |  比對「今天該發的提醒」(重用 schedule.ts)                  v
       +--------------------------------------------------> web-push 送到所有 subscription
                                                                |
                                                          [裝置 sw.js push handler] --> 手機通知
```

## 1. 推播基礎設施

- 新增 `web-push` 套件（後端發送）。
- 一次性產生 VAPID 金鑰（`npx web-push generate-vapid-keys`），放環境變數：
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`（`mailto:matthewlee@zeabur.com`）
  - `CRON_SECRET`（保護 cron endpoint，與 JWT 無關）

## 2. Service Worker push handler

- `public/sw.js` 由 next-pwa 自動產生，不可直接改。改用 next-pwa 的 **custom worker**：
  - 新增 `worker/index.js`，內含 `push` 與 `notificationclick` 事件處理。
  - build 時 next-pwa 會把它編譯成 `public/worker-*.js` 並在 `sw.js` 用 `importScripts` 載入。
- `push` 事件：解析 payload（`{ title, body, url? }`）→ `showNotification`。
- `notificationclick` 事件：關閉通知 → 聚焦既有分頁或開新分頁到 App。

## 3. 資料模型

新增 collection `pushSubscription`：

```ts
type PushSubscriptionDoc = {
  _id: string;
  endpoint: string;      // 唯一，去重用
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: string;
  deletedAt: string | null;
};
```

單人 App，無 userId。以 `endpoint` upsert（一裝置一筆）。查詢一律 `{ deletedAt: null }`。

## 4. API routes

沿用既有「每個 route 檔自帶 verifyAuth」的模式（不抽共用 helper）。

- `GET /api/push/vapid` — JWT 保護；回傳 `{ publicKey }` 給前端訂閱。
- `POST /api/push/subscribe` — JWT 保護；body 為 `PushSubscription` JSON，用 endpoint upsert。
- `POST /api/push/unsubscribe` — JWT 保護；body `{ endpoint }`，軟刪除。
- `POST /api/push/test` — JWT 保護；發一則測試通知到所有訂閱。
- `GET /api/cron/reminders` — 用 `CRON_SECRET` 保護（query `?secret=` 或 `Authorization` header，非 JWT）。
  - 讀取所有 subscription（`deletedAt:null`）、所有 subscription 資料與卡片。
  - 用 `getDueReminders` 算出今天該發的提醒。
  - 用 web-push 發送到每個裝置。
  - 送出時遇到 404/410（訂閱失效）→ 軟刪除該 subscription。
  - 回傳統計 `{ remindersSent, subscriptions, pruned }`。

## 5. 提醒計算（可測純函式）

在 `app/lib/schedule.ts` 新增：

```ts
getDueReminders(
  subscriptions: Subscription[],
  cards: Card[],
  now: Date,
): { title: string; body: string; url: string }[]
```

- 以 **Asia/Taipei（UTC+8，無 DST）** 換算「今天」的年/月/日：`new Date(now.getTime() + 8h)` 取其 UTC 年月日。
- 為處理跨月位移（例如結帳日 31 + N 天落到下月、扣款日 1 - N 天落到上月），對「上月 / 本月 / 下月」都呼叫 `getMonthlyEvents`，收集所有 `reminderDate` 落在今天（台灣日期）的事件。
- 依 `sourceId + kind + date` 去重。
- 產生文案：
  - charge：`{name} 將於 {M/D} 扣款 ${amount} {currency}`
  - statement（可繳費）：`{cardName} 已結帳，可以開始繳費了`
  - due（到期）：`{cardName} 將於 {M/D} 繳費到期`
  - 全部 `url: '/'`。

補上單元測試（今天命中、跨月邊界、時區換算、提醒關閉時不產生）。

## 6. 前端 UI（簡單按鈕 + 測試）

新增 `components/NotificationSetup.tsx`，掛在日程 tab（ScheduleView 內，CardManager 附近）：

- 偵測支援度：`'serviceWorker' in navigator && 'PushManager' in window`。
- 狀態機：
  - 不支援 → 顯示「此裝置不支援通知」。
  - iOS 且非 standalone（未加入主畫面）→ 顯示「請先將此 App 加入主畫面（分享 → 加入主畫面）才能開啟通知」。
  - 支援但未訂閱 → 「🔔 開啟通知」按鈕：`Notification.requestPermission()` → 取 SW registration → `pushManager.subscribe({ userVisibleOnly:true, applicationServerKey })`（key 來自 `GET /api/push/vapid`）→ `POST /api/push/subscribe`。
  - 已訂閱 → 顯示「已開啟通知」＋「發送測試通知」按鈕（`POST /api/push/test`）＋「關閉通知」（unsubscribe）。
- 權限被拒 → 顯示提示訊息。

## 7. 部署後手動步驟（交付清單）

1. 本機跑 `npx web-push generate-vapid-keys`，把 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`、`CRON_SECRET` 加到 Zeabur 環境變數。
2. 到 cron-job.org（或 GitHub Actions）設每日 `01:00 UTC`（= 台灣 09:00）打 `GET https://<app>/api/cron/reminders?secret=<CRON_SECRET>`。

## 8. 測試

- `getDueReminders` 純函式單元測試（vitest）。
- 手動：部署後在手機 PWA 用「發送測試通知」驗證端到端。

## 備註

- 各筆提醒預設 `enabled:false`，推播接好後仍需在各訂閱／卡片打開提醒才會發。此設計不改預設。
- iOS 16.4+ 才支援 PWA Web Push，且必須加入主畫面。使用者確認一律以 PWA 使用。
