import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGO_CONNECTION_STRING as string
let client: MongoClient
let db: Db

export async function getDb() {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
    db = client.db('subtracker')
  }
  return db
} 