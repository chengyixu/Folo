import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { join } from "pathe"

import * as schema from "./schema.js"

const DATA_DIR = process.env.FOLO_DATA_DIR || join(homedir(), ".folo-terminal")
const DB_PATH = join(DATA_DIR, "folo.db")

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

const sqlite = new Database(DB_PATH)
sqlite.pragma("journal_mode = WAL")

export const db = drizzle(sqlite, { schema })

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      title TEXT,
      url TEXT NOT NULL,
      description TEXT,
      image TEXT,
      error_at TEXT,
      site_url TEXT,
      error_message TEXT,
      last_fetched_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      title TEXT,
      url TEXT,
      content TEXT,
      description TEXT,
      guid TEXT NOT NULL,
      author TEXT,
      published_at INTEGER NOT NULL,
      inserted_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      read INTEGER DEFAULT 0,
      starred INTEGER DEFAULT 0,
      categories TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id);
    CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at);
    CREATE INDEX IF NOT EXISTS idx_entries_read ON entries(read);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_guid_feed ON entries(guid, feed_id);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS feed_categories (
      feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (feed_id, category_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_category ON feed_categories(feed_id, category_id);
  `)
}

export function closeDatabase() {
  sqlite.close()
}

export { DATA_DIR, DB_PATH }

export * as schema from "./schema.js"
