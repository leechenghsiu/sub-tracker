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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const { id } = await context.params
    const { person, months, amount, date, note } = await req.json()
    const settlement = {
      _id: new ObjectId(),
      person,
      months: months || [],
      amount: parseFloat(amount),
      date,
      note: note || '',
    }
    await db.collection('subscription').updateOne(
      { _id: new ObjectId(id) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $push: { settlements: settlement } } as any
    )
    return NextResponse.json(settlement)
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const { id } = await context.params
    const { settlementId } = await req.json()
    await db.collection('subscription').updateOne(
      { _id: new ObjectId(id) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $pull: { settlements: { _id: new ObjectId(settlementId) } } } as any
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}
