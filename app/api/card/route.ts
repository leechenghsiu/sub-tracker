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
