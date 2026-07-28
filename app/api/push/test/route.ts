import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { sendToAll } from '@/app/lib/push'

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
    const result = await sendToAll([
      { title: 'SubTracker 測試通知', body: '推播設定成功 🎉', url: '/' },
    ])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: '發送失敗（請確認 VAPID 金鑰已設定）' }, { status: 500 })
  }
}
