import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/app/lib/mongo'

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

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const data = await req.json()
    if (!data?.endpoint || !data?.keys?.p256dh || !data?.keys?.auth) {
      return NextResponse.json({ error: '訂閱資料不完整' }, { status: 400 })
    }
    // 以 endpoint 去重：同一裝置重新訂閱時覆蓋並復活（deletedAt 歸零）。
    await db.collection('pushSubscription').updateOne(
      { endpoint: data.endpoint },
      {
        $set: {
          endpoint: data.endpoint,
          keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
          userAgent: req.headers.get('user-agent') || '',
          deletedAt: null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}
