import { MongoClient, Db } from 'mongodb'

const uri = process.env.DATABASE_URL as string
let client: MongoClient
let db: Db

export async function getDb() {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
    db = client.db() // 使用連線字串中的預設資料庫
  }
  return db
} 