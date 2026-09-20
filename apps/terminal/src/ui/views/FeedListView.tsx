import { Box, Text, useInput } from "ink"
import * as React from "react"
import { useCallback, useEffect, useState } from "react"

import type { FeedSchema } from "../../db/schema.js"
import { EntryService } from "../../services/entry.js"
import { FeedService } from "../../services/feed.js"
import { Header, List, StatusBar } from "../components/index.js"

interface FeedListViewProps {
  onSelectFeed: (feedId: string) => void
  onAddFeed: () => void
  onRefreshAll: () => void
  onQuit: () => void
}

export function FeedListView({ onSelectFeed, onAddFeed, onRefreshAll, onQuit }: FeedListViewProps) {
  const [feeds, setFeeds] = useState<FeedSchema[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(() => new Map())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>()

  const loadFeeds = useCallback(async () => {
    setLoading(true)
    try {
      const feedList = await FeedService.getAll()
      const counts = await EntryService.getUnreadCountByFeed()
      setFeeds(feedList)
      setUnreadCounts(counts)
    } catch (error) {
      setStatus(`Error loading feeds: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFeeds()
  }, [loadFeeds])

  useInput((input, key) => {
    if (loading) return

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(feeds.length - 1, i + 1))
    } else if (key.return || input === "l") {
      if (feeds[selectedIndex]) {
        onSelectFeed(feeds[selectedIndex].id)
      }
    } else
      switch (input) {
        case "a": {
          onAddFeed()

          break
        }
        case "r": {
          onRefreshAll()

          break
        }
        case "q": {
          onQuit()

          break
        }
        // No default
      }
  })

  const listItems = feeds.map((feed) => ({
    id: feed.id,
    label: feed.title || feed.url,
    secondary: feed.errorMessage ? "⚠️ Error" : undefined,
    badge: unreadCounts.get(feed.id) || 0,
    isUnread: (unreadCounts.get(feed.id) || 0) > 0,
  }))

  const totalUnread = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0)

  return (
    <Box flexDirection="column" height="100%">
      <Header title="📰 Folo Terminal" subtitle={`${feeds.length} feeds · ${totalUnread} unread`} />

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {loading ? (
          <Text>Loading feeds...</Text>
        ) : (
          <List
            items={listItems}
            selectedIndex={selectedIndex}
            emptyMessage="No feeds yet. Press 'a' to add one."
          />
        )}
      </Box>

      <StatusBar
        message={status}
        hints={["↑↓/jk:navigate", "Enter/l:open", "a:add feed", "r:refresh all", "q:quit"]}
      />
    </Box>
  )
}
