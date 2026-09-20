import { and, desc, eq, sql } from "drizzle-orm"

import { db } from "../db/index.js"
import type { EntrySchema } from "../db/schema.js"
import { entriesTable, feedsTable } from "../db/schema.js"
import { nanoid } from "../utils/nanoid.js"

export const EntryService = {
  async getAll(options?: {
    limit?: number
    offset?: number
    feedId?: string
    unreadOnly?: boolean
  }) {
    const { limit = 50, offset = 0, feedId, unreadOnly } = options ?? {}

    const conditions = []
    if (feedId) {
      conditions.push(eq(entriesTable.feedId, feedId))
    }
    if (unreadOnly) {
      conditions.push(eq(entriesTable.read, false))
    }

    return db
      .select({
        entry: entriesTable,
        feed: feedsTable,
      })
      .from(entriesTable)
      .leftJoin(feedsTable, eq(entriesTable.feedId, feedsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(entriesTable.publishedAt))
      .limit(limit)
      .offset(offset)
  },

  async getById(id: string) {
    const results = await db
      .select({
        entry: entriesTable,
        feed: feedsTable,
      })
      .from(entriesTable)
      .leftJoin(feedsTable, eq(entriesTable.feedId, feedsTable.id))
      .where(eq(entriesTable.id, id))
    return results[0] ?? null
  },

  async getByGuidAndFeed(guid: string, feedId: string) {
    const results = await db
      .select()
      .from(entriesTable)
      .where(and(eq(entriesTable.guid, guid), eq(entriesTable.feedId, feedId)))
    return results[0] ?? null
  },

  async create(entry: Omit<EntrySchema, "id" | "insertedAt">) {
    const id = nanoid()
    await db.insert(entriesTable).values({
      ...entry,
      id,
    })
    return id
  },

  async upsertMany(entries: Omit<EntrySchema, "id" | "insertedAt">[]) {
    if (entries.length === 0) return

    for (const entry of entries) {
      const existing = await this.getByGuidAndFeed(entry.guid, entry.feedId)
      if (existing) {
        await db
          .update(entriesTable)
          .set({
            title: entry.title,
            url: entry.url,
            content: entry.content,
            description: entry.description,
            author: entry.author,
            publishedAt: entry.publishedAt,
            categories: entry.categories,
          })
          .where(eq(entriesTable.id, existing.id))
      } else {
        await this.create(entry)
      }
    }
  },

  async markAsRead(id: string) {
    await db.update(entriesTable).set({ read: true }).where(eq(entriesTable.id, id))
  },

  async markAsUnread(id: string) {
    await db.update(entriesTable).set({ read: false }).where(eq(entriesTable.id, id))
  },

  async markAllAsRead(feedId?: string) {
    const query = db.update(entriesTable).set({ read: true })
    if (feedId) {
      await query.where(eq(entriesTable.feedId, feedId))
    } else {
      await query
    }
  },

  async toggleStarred(id: string) {
    const entry = await db.select().from(entriesTable).where(eq(entriesTable.id, id))
    if (entry[0]) {
      await db
        .update(entriesTable)
        .set({ starred: !entry[0].starred })
        .where(eq(entriesTable.id, id))
    }
  },

  async getStarred(limit = 50) {
    return db
      .select({
        entry: entriesTable,
        feed: feedsTable,
      })
      .from(entriesTable)
      .leftJoin(feedsTable, eq(entriesTable.feedId, feedsTable.id))
      .where(eq(entriesTable.starred, true))
      .orderBy(desc(entriesTable.publishedAt))
      .limit(limit)
  },

  async delete(id: string) {
    await db.delete(entriesTable).where(eq(entriesTable.id, id))
  },

  async deleteByFeedId(feedId: string) {
    await db.delete(entriesTable).where(eq(entriesTable.feedId, feedId))
  },

  async getUnreadCount(feedId?: string) {
    const conditions = [eq(entriesTable.read, false)]
    if (feedId) {
      conditions.push(eq(entriesTable.feedId, feedId))
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(entriesTable)
      .where(and(...conditions))

    return result[0]?.count ?? 0
  },

  async getTotalCount() {
    const result = await db.select({ count: sql<number>`count(*)` }).from(entriesTable)
    return result[0]?.count ?? 0
  },

  async getStarredCount() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(entriesTable)
      .where(eq(entriesTable.starred, true))
    return result[0]?.count ?? 0
  },

  async getUnreadCountByFeed() {
    const result = await db
      .select({
        feedId: entriesTable.feedId,
        count: sql<number>`count(*)`,
      })
      .from(entriesTable)
      .where(eq(entriesTable.read, false))
      .groupBy(entriesTable.feedId)

    return new Map(result.map((r) => [r.feedId, r.count]))
  },
}
