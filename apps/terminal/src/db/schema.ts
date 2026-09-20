import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const feedsTable = sqliteTable("feeds", {
  id: text("id").primaryKey(),
  title: text("title"),
  url: text("url").notNull(),
  description: text("description"),
  image: text("image"),
  errorAt: text("error_at"),
  siteUrl: text("site_url"),
  errorMessage: text("error_message"),
  lastFetchedAt: integer("last_fetched_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const entriesTable = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    feedId: text("feed_id")
      .notNull()
      .references(() => feedsTable.id, { onDelete: "cascade" }),
    title: text("title"),
    url: text("url"),
    content: text("content"),
    description: text("description"),
    guid: text("guid").notNull(),
    author: text("author"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    read: integer("read", { mode: "boolean" }).default(false),
    starred: integer("starred", { mode: "boolean" }).default(false),
    categories: text("categories", { mode: "json" }).$type<string[]>(),
  },
  (table) => [
    index("idx_entries_feed_id").on(table.feedId),
    index("idx_entries_published_at").on(table.publishedAt),
    index("idx_entries_read").on(table.read),
    uniqueIndex("idx_entries_guid_feed").on(table.guid, table.feedId),
  ],
)

export const categoriesTable = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const feedCategoriesTable = sqliteTable(
  "feed_categories",
  {
    feedId: text("feed_id")
      .notNull()
      .references(() => feedsTable.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("idx_feed_category").on(table.feedId, table.categoryId)],
)

export type FeedSchema = typeof feedsTable.$inferInsert
export type EntrySchema = typeof entriesTable.$inferInsert
export type CategorySchema = typeof categoriesTable.$inferInsert
