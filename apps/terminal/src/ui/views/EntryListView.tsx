import { Box, Text, useInput } from "ink"
import * as React from "react"
import { useCallback, useEffect, useState } from "react"

import type { EntrySchema, FeedSchema } from "../../db/schema.js"
import { EntryService } from "../../services/entry.js"
import { FeedService } from "../../services/feed.js"
import { Header, List, StatusBar } from "../components/index.js"

interface EntryListViewProps {
  feedId: string
  onSelectEntry: (entryId: string) => void
  onBack: () => void
  onRefresh: () => void
}

export function EntryListView({ feedId, onSelectEntry, onBack, onRefresh }: EntryListViewProps) {
  const [feed, setFeed] = useState<FeedSchema | null>(null)
  const [entries, setEntries] = useState<{ entry: EntrySchema; feed: FeedSchema | null }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const feedData = await FeedService.getById(feedId)
      const entryList = await EntryService.getAll({ feedId, limit: 100 })
      setFeed(feedData)
      setEntries(entryList)
    } catch (error) {
      setStatus(`Error loading entries: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [feedId])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  useInput((input, key) => {
    if (loading) return

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(entries.length - 1, i + 1))
    } else if (key.return || input === "l") {
      if (entries[selectedIndex]) {
        onSelectEntry(entries[selectedIndex].entry.id)
      }
    } else if (key.escape || input === "h" || input === "q") {
      onBack()
    } else
      switch (input) {
        case "r": {
          onRefresh()

          break
        }
        case "m": {
          if (entries[selectedIndex]) {
            const { entry } = entries[selectedIndex]
            if (entry.read) {
              EntryService.markAsUnread(entry.id)
            } else {
              EntryService.markAsRead(entry.id)
            }
            loadEntries()
          }

          break
        }
        case "M": {
          EntryService.markAllAsRead(feedId)
          loadEntries()

          break
        }
        case "s": {
          if (entries[selectedIndex]) {
            EntryService.toggleStarred(entries[selectedIndex].entry.id)
            loadEntries()
          }

          break
        }
        // No default
      }
  })

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return `${minutes}m ago`
      }
      return `${hours}h ago`
    }
    if (days === 1) return "yesterday"
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const listItems = entries.map(({ entry }) => ({
    id: entry.id,
    label: `${entry.starred ? "★ " : ""}${entry.title || "(No title)"}`,
    secondary: formatDate(entry.publishedAt),
    isUnread: !entry.read,
  }))

  const unreadCount = entries.filter((e) => !e.entry.read).length

  return (
    <Box flexDirection="column" height="100%">
      <Header
        title={feed?.title || "Loading..."}
        subtitle={`${entries.length} entries · ${unreadCount} unread`}
      />

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {loading ? (
          <Text>Loading entries...</Text>
        ) : (
          <List
            items={listItems}
            selectedIndex={selectedIndex}
            emptyMessage="No entries in this feed."
          />
        )}
      </Box>

      <StatusBar
        message={status}
        hints={[
          "↑↓/jk:navigate",
          "Enter/l:read",
          "h/Esc:back",
          "m:toggle read",
          "M:mark all read",
          "s:star",
          "r:refresh",
        ]}
      />
    </Box>
  )
}
