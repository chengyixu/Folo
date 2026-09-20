import { Box } from "ink"
import open from "open"
import * as React from "react"
import { useCallback, useState } from "react"

import { RssService } from "../services/rss.js"
import { AddFeedView, EntryListView, EntryView, FeedListView } from "./views/index.js"

type View =
  | { type: "feeds" }
  | { type: "entries"; feedId: string }
  | { type: "entry"; entryId: string; feedId: string }
  | { type: "addFeed" }

interface AppProps {
  onQuit: () => void
}

export function App({ onQuit }: AppProps) {
  const [view, setView] = useState<View>({ type: "feeds" })
  const [refreshKey, setRefreshKey] = useState(0)

  const openInBrowser = async (url: string) => {
    try {
      await open(url)
    } catch (error) {
      console.error("Failed to open browser:", error)
    }
  }

  const handleRefreshAll = useCallback(async () => {
    try {
      await RssService.refreshAllFeeds()
      setRefreshKey((k) => k + 1)
    } catch (error) {
      console.error("Failed to refresh feeds:", error)
    }
  }, [])

  const handleRefreshFeed = useCallback(async (feedId: string) => {
    try {
      await RssService.refreshFeed(feedId)
      setRefreshKey((k) => k + 1)
    } catch (error) {
      console.error("Failed to refresh feed:", error)
    }
  }, [])

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {view.type === "feeds" && (
        <FeedListView
          key={refreshKey}
          onSelectFeed={(feedId) => setView({ type: "entries", feedId })}
          onAddFeed={() => setView({ type: "addFeed" })}
          onRefreshAll={handleRefreshAll}
          onQuit={onQuit}
        />
      )}

      {view.type === "entries" && (
        <EntryListView
          key={`${view.feedId}-${refreshKey}`}
          feedId={view.feedId}
          onSelectEntry={(entryId) => setView({ type: "entry", entryId, feedId: view.feedId })}
          onBack={() => setView({ type: "feeds" })}
          onRefresh={() => handleRefreshFeed(view.feedId)}
        />
      )}

      {view.type === "entry" && (
        <EntryView
          key={view.entryId}
          entryId={view.entryId}
          onBack={() => setView({ type: "entries", feedId: view.feedId })}
          onOpenInBrowser={openInBrowser}
        />
      )}

      {view.type === "addFeed" && (
        <AddFeedView
          onComplete={(feedId) => {
            if (feedId) {
              setRefreshKey((k) => k + 1)
            }
            setView({ type: "feeds" })
          }}
          onCancel={() => setView({ type: "feeds" })}
        />
      )}
    </Box>
  )
}
