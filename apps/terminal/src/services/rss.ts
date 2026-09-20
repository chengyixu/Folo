import type { Item } from "rss-parser"
import Parser from "rss-parser"

import { EntryService } from "./entry.js"
import { FeedService } from "./feed.js"

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Folo-Terminal/1.0 (RSS Reader)",
  },
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
})

const FOLO_API_BASE = "https://api.follow.is"

function isRsshubUrl(url: string): boolean {
  return url.startsWith("rsshub://")
}

export interface FeedDiscoveryResult {
  title: string
  description?: string
  url: string
  siteUrl?: string
  image?: string
}

interface FoloApiFeed {
  title?: string
  description?: string
  siteUrl?: string
  image?: string
}

interface FoloApiEntry {
  id?: string
  title?: string
  url?: string
  content?: string
  description?: string
  guid?: string
  author?: string
  publishedAt?: string
  categories?: string[]
}

interface FoloApiResponse {
  data?: {
    feed?: FoloApiFeed
    entries?: FoloApiEntry[]
  }
}

interface ExtendedRssItem extends Item {
  contentEncoded?: string
  summary?: string
  author?: string
}

export interface ParsedEntry {
  title: string | undefined
  url: string | undefined
  content: string | undefined
  description: string | undefined
  guid: string
  author: string | undefined
  publishedAt: Date
  categories: string[]
}

export const RssService = {
  async discoverFeed(url: string): Promise<FeedDiscoveryResult | null> {
    // Handle rsshub:// URLs via Folo API (direct fetch)
    if (isRsshubUrl(url)) {
      try {
        const apiUrl = `${FOLO_API_BASE}/feeds?url=${encodeURIComponent(url)}`
        const res = await fetch(apiUrl, {
          headers: { "User-Agent": "Folo-Terminal/1.0" },
        })
        if (!res.ok) {
          console.error(`Folo API returned ${res.status} for ${url}`)
          return null
        }
        const json = (await res.json()) as FoloApiResponse
        const feed = json.data?.feed
        if (!feed) {
          console.error(`Folo API returned no feed for ${url}`)
          return null
        }
        return {
          title: feed.title || url,
          description: feed.description || undefined,
          url, // Keep the original rsshub:// URL
          siteUrl: feed.siteUrl || undefined,
          image: feed.image || undefined,
        }
      } catch (error) {
        console.error(`Failed to discover feed via Folo API at ${url}:`, error)
        return null
      }
    }

    // Handle regular HTTP URLs with rss-parser
    try {
      const feed = await parser.parseURL(url)
      return {
        title: feed.title || url,
        description: feed.description,
        url: feed.feedUrl || url,
        siteUrl: feed.link,
        image: feed.image?.url,
      }
    } catch (error) {
      console.error(`Failed to discover feed at ${url}:`, error)
      return null
    }
  },

  async fetchFeed(url: string): Promise<ParsedEntry[]> {
    // Handle rsshub:// URLs via Folo API (direct fetch)
    // The /feeds endpoint returns entries along with feed info
    if (isRsshubUrl(url)) {
      try {
        const apiUrl = `${FOLO_API_BASE}/feeds?url=${encodeURIComponent(url)}`
        const res = await fetch(apiUrl, {
          headers: { "User-Agent": "Folo-Terminal/1.0" },
        })
        if (!res.ok) {
          throw new Error(`Folo API returned ${res.status}`)
        }
        const json = (await res.json()) as FoloApiResponse
        const entries = json.data?.entries || []
        return entries.map((entry) => ({
          title: entry.title,
          url: entry.url,
          content: entry.content,
          description: entry.description,
          guid: entry.guid || entry.id || entry.url || String(Date.now()),
          author: entry.author,
          publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : new Date(),
          categories: entry.categories || [],
        }))
      } catch (error) {
        console.error(`Failed to fetch feed via Folo API at ${url}:`, error)
        throw error
      }
    }

    // Handle regular HTTP URLs with rss-parser
    try {
      const feed = await parser.parseURL(url)
      return (feed.items || []).map((item) => {
        const extended = item as ExtendedRssItem
        return {
          title: extended.title,
          url: extended.link,
          content: extended.contentEncoded || extended.content,
          description: extended.contentSnippet || extended.summary,
          guid: extended.guid || extended.link || extended.title || String(Date.now()),
          author: extended.creator || extended.author,
          publishedAt: extended.pubDate ? new Date(extended.pubDate) : new Date(),
          categories: extended.categories || [],
        }
      })
    } catch (error) {
      console.error(`Failed to fetch feed at ${url}:`, error)
      throw error
    }
  },

  async subscribeFeed(url: string): Promise<{ feedId: string; newEntries: number }> {
    const existingFeed = await FeedService.getByUrl(url)
    if (existingFeed) {
      return { feedId: existingFeed.id, newEntries: 0 }
    }

    const discovery = await this.discoverFeed(url)
    if (!discovery) {
      throw new Error(`Could not parse feed at ${url}`)
    }

    const feedId = await FeedService.create({
      title: discovery.title,
      description: discovery.description,
      url: discovery.url,
      siteUrl: discovery.siteUrl,
      image: discovery.image,
    })

    const entries = await this.fetchFeed(url)
    await this.saveEntries(feedId, entries)

    await FeedService.updateLastFetched(feedId)

    return { feedId, newEntries: entries.length }
  },

  async refreshFeed(feedId: string): Promise<number> {
    const feed = await FeedService.getById(feedId)
    if (!feed) {
      throw new Error(`Feed not found: ${feedId}`)
    }

    try {
      const entries = await this.fetchFeed(feed.url)
      const newCount = await this.saveEntries(feedId, entries)
      await FeedService.updateLastFetched(feedId)
      await FeedService.clearError(feedId)
      return newCount
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await FeedService.setError(feedId, message)
      throw error
    }
  },

  async refreshAllFeeds(): Promise<Map<string, number | Error>> {
    const feeds = await FeedService.getAll()
    const results = new Map<string, number | Error>()

    for (const feed of feeds) {
      try {
        const newCount = await this.refreshFeed(feed.id)
        results.set(feed.id, newCount)
      } catch (error) {
        results.set(feed.id, error instanceof Error ? error : new Error(String(error)))
      }
    }

    return results
  },

  async saveEntries(feedId: string, entries: ParsedEntry[]): Promise<number> {
    let newCount = 0

    for (const entry of entries) {
      const existing = await EntryService.getByGuidAndFeed(entry.guid, feedId)
      if (!existing) {
        await EntryService.create({
          feedId,
          title: entry.title,
          url: entry.url,
          content: entry.content,
          description: entry.description,
          guid: entry.guid,
          author: entry.author,
          publishedAt: entry.publishedAt,
          categories: entry.categories,
        })
        newCount++
      }
    }

    return newCount
  },

  async unsubscribeFeed(feedId: string): Promise<void> {
    await EntryService.deleteByFeedId(feedId)
    await FeedService.delete(feedId)
  },
}
