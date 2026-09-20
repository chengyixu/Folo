import { and, desc, eq, sql } from "drizzle-orm"

import { db } from "../db/index.js"
import type { FeedSchema } from "../db/schema.js"
import { entriesTable, feedsTable } from "../db/schema.js"
import { nanoid } from "../utils/nanoid.js"

export const FeedService = {
  async getAll() {
    return db.select().from(feedsTable).orderBy(desc(feedsTable.createdAt))
  },

  async getById(id: string) {
    const results = await db.select().from(feedsTable).where(eq(feedsTable.id, id))
    return results[0] ?? null
  },

  async getByUrl(url: string) {
    const results = await db.select().from(feedsTable).where(eq(feedsTable.url, url))
    return results[0] ?? null
  },

  async create(feed: Omit<FeedSchema, "id" | "createdAt">) {
    const id = nanoid()
    await db.insert(feedsTable).values({
      ...feed,
      id,
    })
    return id
  },

  async update(id: string, data: Partial<FeedSchema>) {
    await db.update(feedsTable).set(data).where(eq(feedsTable.id, id))
  },

  async delete(id: string) {
    await db.delete(feedsTable).where(eq(feedsTable.id, id))
  },

  async updateLastFetched(id: string) {
    await db.update(feedsTable).set({ lastFetchedAt: new Date() }).where(eq(feedsTable.id, id))
  },

  async setError(id: string, errorMessage: string) {
    await db
      .update(feedsTable)
      .set({
        errorAt: new Date().toISOString(),
        errorMessage,
      })
      .where(eq(feedsTable.id, id))
  },

  async clearError(id: string) {
    await db
      .update(feedsTable)
      .set({
        errorAt: null,
        errorMessage: null,
      })
      .where(eq(feedsTable.id, id))
  },

  async getUnreadCount(feedId: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(entriesTable)
      .where(and(eq(entriesTable.feedId, feedId), eq(entriesTable.read, false)))
    return result[0]?.count ?? 0
  },
}
