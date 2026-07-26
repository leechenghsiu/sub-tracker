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
    if ('dueDay' in data) update.dueDay = data.dueDay === '' || data.dueDay == null ? null : parseInt(data.dueDay, 10)
    if ('payReminder' in data) {
      update.payReminder = {
        enabled: !!data.payReminder?.enabled,
        daysAfter: Number(data.payReminder?.daysAfter ?? 1),
      }
    }
    if ('dueReminder' in data) {
      update.dueReminder = {
        enabled: !!data.dueReminder?.enabled,
        daysBefore: Number(data.dueReminder?.daysBefore ?? 3),
      }
    }
    await db.collection('card').updateOne({ _id: new ObjectId(id) }, { $set: update })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}
