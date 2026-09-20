import cors from "@fastify/cors"
import Fastify from "fastify"

import { EntryService } from "../services/entry.js"
import { FeedService } from "../services/feed.js"
import { RssService } from "../services/rss.js"

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function isSupportedFeedUrl(value: string): boolean {
  if (value.startsWith("rsshub://")) return value.length > "rsshub://".length
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export async function startServer(port = 3847) {
  const fastify = Fastify({
    logger: false,
  })
  await fastify.register(cors, {
    origin: [/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/],
  })

  // Health check
  fastify.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() }
  })

  // Feeds
  fastify.get("/api/feeds", async () => {
    const feeds = await FeedService.getAll()
    const unreadCounts = await EntryService.getUnreadCountByFeed()
    return feeds.map((feed) => ({
      ...feed,
      unreadCount: unreadCounts.get(feed.id) || 0,
    }))
  })

  fastify.get<{ Params: { id: string } }>("/api/feeds/:id", async (request, reply) => {
    const feed = await FeedService.getById(request.params.id)
    if (!feed) {
      return reply.status(404).send({ error: "Feed not found" })
    }
    const unreadCount = await EntryService.getUnreadCount(feed.id)
    return { ...feed, unreadCount }
  })

  fastify.post<{ Body: { url: string } }>("/api/feeds", async (request, reply) => {
    try {
      const { url } = request.body
      if (typeof url !== "string" || !isSupportedFeedUrl(url)) {
        return reply
          .status(400)
          .send({ error: "Feed URL must use http://, https://, or rsshub://" })
      }
      const result = await RssService.subscribeFeed(url)
      return { feedId: result.feedId, newEntries: result.newEntries }
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Failed to subscribe",
      })
    }
  })

  fastify.delete<{ Params: { id: string } }>("/api/feeds/:id", async (request, reply) => {
    try {
      await RssService.unsubscribeFeed(request.params.id)
      return { success: true }
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Failed to unsubscribe",
      })
    }
  })

  fastify.post<{ Params: { id: string } }>("/api/feeds/:id/refresh", async (request, reply) => {
    try {
      const newEntries = await RssService.refreshFeed(request.params.id)
      return { newEntries }
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Failed to refresh",
      })
    }
  })

  fastify.post("/api/feeds/refresh-all", async () => {
    const results = await RssService.refreshAllFeeds()
    const response: Record<string, number | string> = {}
    results.forEach((value, key) => {
      response[key] = value instanceof Error ? value.message : value
    })
    return response
  })

  // Entries
  fastify.get<{
    Querystring: { feedId?: string; unreadOnly?: string; limit?: string; offset?: string }
  }>("/api/entries", async (request) => {
    const { feedId, unreadOnly, limit, offset } = request.query
    const entries = await EntryService.getAll({
      feedId,
      unreadOnly: unreadOnly === "true",
      limit: parseBoundedInteger(limit, 50, 1, 500),
      offset: parseBoundedInteger(offset, 0, 0, 1_000_000),
    })
    return entries.map(({ entry, feed }) => ({
      ...entry,
      feedTitle: feed?.title,
    }))
  })

  fastify.get<{ Params: { id: string } }>("/api/entries/:id", async (request, reply) => {
    const result = await EntryService.getById(request.params.id)
    if (!result) {
      return reply.status(404).send({ error: "Entry not found" })
    }
    return {
      ...result.entry,
      feedTitle: result.feed?.title,
    }
  })

  fastify.post<{ Params: { id: string } }>("/api/entries/:id/read", async (request) => {
    await EntryService.markAsRead(request.params.id)
    return { success: true }
  })

  fastify.post<{ Params: { id: string } }>("/api/entries/:id/unread", async (request) => {
    await EntryService.markAsUnread(request.params.id)
    return { success: true }
  })

  fastify.post<{ Body: { feedId?: string } }>("/api/entries/mark-all-read", async (request) => {
    await EntryService.markAllAsRead(request.body?.feedId)
    return { success: true }
  })

  fastify.post<{ Params: { id: string } }>("/api/entries/:id/toggle-star", async (request) => {
    await EntryService.toggleStarred(request.params.id)
    return { success: true }
  })

  fastify.get("/api/entries/starred", async () => {
    const entries = await EntryService.getStarred()
    return entries.map(({ entry, feed }) => ({
      ...entry,
      feedTitle: feed?.title,
    }))
  })

  // Stats
  fastify.get("/api/stats", async () => {
    const feeds = await FeedService.getAll()
    const totalEntries = await EntryService.getTotalCount()
    const unreadEntries = await EntryService.getUnreadCount()
    const starredEntries = await EntryService.getStarredCount()
    const unreadByFeed = await EntryService.getUnreadCountByFeed()

    return {
      totalFeeds: feeds.length,
      totalEntries,
      unreadEntries,
      starredEntries,
      feedStats: feeds.map((feed) => ({
        id: feed.id,
        title: feed.title,
        unread: unreadByFeed.get(feed.id) || 0,
        hasError: !!feed.errorMessage,
      })),
    }
  })

  await fastify.listen({ port, host: "127.0.0.1" })
  const address = fastify.server.address()
  const listeningPort = typeof address === "object" && address ? address.port : port
  return { port: listeningPort, close: () => fastify.close() }
}
