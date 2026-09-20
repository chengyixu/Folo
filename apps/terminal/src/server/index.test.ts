import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"

import { join } from "pathe"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

let baseUrl: string
let closeServer: () => Promise<void>
let closeDatabase: () => void
let dataDirectory: string

beforeAll(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), "folo-terminal-test-"))
  process.env.FOLO_DATA_DIR = dataDirectory
  vi.resetModules()

  const database = await import("../db/index.js")
  const { EntryService } = await import("../services/entry.js")
  const { FeedService } = await import("../services/feed.js")
  const { startServer } = await import("./index.js")

  database.initializeDatabase()
  closeDatabase = database.closeDatabase

  const feedId = await FeedService.create({
    title: "Test feed",
    url: "https://example.com/feed.xml",
  })
  await EntryService.create({
    feedId,
    title: "Unread entry",
    guid: "unread-entry",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    read: false,
  })
  await EntryService.create({
    feedId,
    title: "Read entry",
    guid: "read-entry",
    publishedAt: new Date("2026-01-02T00:00:00Z"),
    read: true,
    starred: true,
  })

  const server = await startServer(0)
  baseUrl = `http://127.0.0.1:${server.port}`
  closeServer = server.close
})

afterAll(async () => {
  await closeServer()
  closeDatabase()
  await rm(dataDirectory, { recursive: true, force: true })
  delete process.env.FOLO_DATA_DIR
})

describe("Folo terminal API", () => {
  it("reports health and accurate entry statistics", async () => {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json())
    const stats = await fetch(`${baseUrl}/api/stats`).then((response) => response.json())

    expect(health.status).toBe("ok")
    expect(stats).toMatchObject({
      totalFeeds: 1,
      totalEntries: 2,
      unreadEntries: 1,
      starredEntries: 1,
    })
    expect(stats.feedStats[0].unread).toBe(1)
  })

  it("rejects unsupported feed URL schemes", async () => {
    const response = await fetch(`${baseUrl}/api/feeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "file:///etc/passwd" }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Feed URL must use http://, https://, or rsshub://",
    })
  })
})
