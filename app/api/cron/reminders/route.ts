import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/app/lib/mongo'
import { getDueReminders } from '@/app/lib/schedule'
import { sendToAll } from '@/app/lib/push'
import type { Subscription, Card } from '@/components/types'

// 由外部 cron 每日呼叫（台灣 09:00 = UTC 01:00）。以 CRON_SECRET 保護，非 JWT。
function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const fromQuery = req.nextUrl.searchParams.get('secret')
  const fromHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  return fromQuery === secret || fromHeader === secret
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const [subscriptions, cards] = await Promise.all([
      db.collection('subscription').find({ deletedAt: null }).toArray(),
      db.collection('card').find({ deletedAt: null }).toArray(),
    ])
    const reminders = getDueReminders(
      subscriptions as unknown as Subscription[],
      cards as unknown as Card[],
      new Date(),
    )
    const result = await sendToAll(reminders)
    return NextResponse.json({ reminders: reminders.length, ...result })
  } catch {
    return NextResponse.json({ error: '排程執行失敗' }, { status: 500 })
  }
}
