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
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: '缺少 endpoint' }, { status: 400 })
    await db.collection('pushSubscription').updateOne(
      { endpoint },
      { $set: { deletedAt: new Date() } },
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}
