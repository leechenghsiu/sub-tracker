import webpush from 'web-push'
import { getDb } from './mongo'

let configured = false

// 首次呼叫時以環境變數設定 VAPID。缺金鑰時丟錯，讓 route 回 500。
function configure() {
  if (configured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:matthewlee@zeabur.com'
  if (!pub || !priv) throw new Error('缺少 VAPID 金鑰環境變數')
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
}

export type PushPayload = { title: string; body: string; url?: string }

// 發送多則通知到所有已訂閱裝置；遇到失效訂閱（404/410）順手軟刪除。
export async function sendToAll(
  payloads: PushPayload[],
): Promise<{ sent: number; pruned: number; devices: number }> {
  if (payloads.length === 0) return { sent: 0, pruned: 0, devices: 0 }
  configure()
  const db = await getDb()
  const subs = await db.collection('pushSubscription').find({ deletedAt: null }).toArray()
  let sent = 0
  let pruned = 0
  for (const s of subs) {
    const subscription = { endpoint: s.endpoint as string, keys: s.keys as { p256dh: string; auth: string } }
    let dead = false
    for (const p of payloads) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(p))
        sent++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          dead = true
          break
        }
      }
    }
    if (dead) {
      await db.collection('pushSubscription').updateOne({ _id: s._id }, { $set: { deletedAt: new Date() } })
      pruned++
    }
  }
  return { sent, pruned, devices: subs.length }
}
