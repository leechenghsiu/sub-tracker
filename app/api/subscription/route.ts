import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/app/lib/mongo'
import { ObjectId } from 'mongodb'
import { getExchangeRates } from '@/app/lib/exchangeRates';

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
    const subscriptions = await db.collection('subscription').find({ deletedAt: null }).sort({ createdAt: -1 }).toArray()
    const rates = await getExchangeRates();
    // 換算台幣金額
    function convert(amount: number, cycle: string, mode: 'monthly'|'halfyear'|'yearly') {
      if (mode === 'monthly') {
        if (cycle === 'monthly') return amount;
        if (cycle === 'halfyear') return amount / 6;
        if (cycle === 'yearly') return amount / 12;
      }
      if (mode === 'halfyear') {
        if (cycle === 'monthly') return amount * 6;
        if (cycle === 'halfyear') return amount;
        if (cycle === 'yearly') return amount / 2;
      }
      if (mode === 'yearly') {
        if (cycle === 'monthly') return amount * 12;
        if (cycle === 'halfyear') return amount * 2;
        if (cycle === 'yearly') return amount;
      }
      return amount;
    }
    // 預設 mode monthly
    const modeParam = req.nextUrl.searchParams.get('mode');
    const mode = (modeParam === 'monthly' || modeParam === 'halfyear' || modeParam === 'yearly') ? modeParam : 'monthly';
    const withTWD = subscriptions.map(sub => {
      const total = Number(sub.price) || 0;
      const self = Number(sub.selfRatio) || 1;
      const adv = Number(sub.advanceRatio) || 0;
      const myAmount = total * (self / (self + (sub.isAdvance ? adv : 0)));
      const displayAmount = convert(myAmount, sub.cycle, mode);
      const twdAmount = (rates[sub.currency] || 1) * displayAmount;
      return { ...sub, twdAmount };
    });
    // 預設金額排序（desc）
    withTWD.sort((a, b) => b.twdAmount - a.twdAmount);
    return NextResponse.json(withTWD || [])
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
      ...data,
      price: parseFloat(data.price),
      billingDate: new Date(data.billingDate),
      createdAt: new Date(),
      deletedAt: null
    }
    const result = await db.collection('subscription').insertOne(doc)
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
    const result = await db.collection('subscription').updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date() } }
    )
    return NextResponse.json({ success: result.modifiedCount === 1 })
  } catch {
    return NextResponse.json({ error: '資料庫錯誤' }, { status: 500 })
  }
} 