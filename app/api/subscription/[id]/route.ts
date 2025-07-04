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
    const data = await req.json()
    const { id } = await context.params
    const update = { ...data }
    delete update._id
    delete update.createdAt
    delete update.deletedAt
    if (update.price !== undefined) update.price = parseFloat(update.price)
    if (update.billingDate) update.billingDate = new Date(update.billingDate)
    const result = await db.collection('subscription').updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    )
    return NextResponse.json({ success: result.modifiedCount === 1 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(req)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  try {
    const db = await getDb()
    const { id } = await context.params
    const result = await db.collection('subscription').updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date() } }
    )
    return NextResponse.json({ success: result.modifiedCount === 1 })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
} 