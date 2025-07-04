import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const USERNAME = process.env.USERNAME || ''
const PASSWORD = process.env.PASSWORD || ''

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (username !== USERNAME || password !== PASSWORD) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  // 建立 JWT
  const token = jwt.sign({ username }, PASSWORD, { expiresIn: '7d' })

  // 回傳 token
  return NextResponse.json({ token })
} 