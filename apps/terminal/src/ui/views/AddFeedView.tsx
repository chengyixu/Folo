import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import * as React from "react"
import { useState } from "react"

import { RssService } from "../../services/rss.js"
import { Header, StatusBar } from "../components/index.js"

interface AddFeedViewProps {
  onComplete: (feedId: string | null) => void
  onCancel: () => void
}

export function AddFeedView({ onComplete, onCancel }: AddFeedViewProps) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<string>()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!url.trim()) {
      setStatus("Please enter a URL")
      return
    }

    let feedUrl = url.trim()
    if (!feedUrl.startsWith("http://") && !feedUrl.startsWith("https://")) {
      feedUrl = `https://${feedUrl}`
    }

    setLoading(true)
    setStatus("Discovering feed...")

    try {
      const result = await RssService.subscribeFeed(feedUrl)
      setStatus(`Subscribed! Added ${result.newEntries} entries.`)
      setTimeout(() => onComplete(result.feedId), 1000)
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
      setLoading(false)
    }
  }

  useInput((input, key) => {
    if (loading) return

    if (key.escape) {
      onCancel()
    }
  })

  return (
    <Box flexDirection="column" height="100%">
      <Header title="Add Feed" subtitle="Enter the URL of an RSS or Atom feed" />

      <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
        <Box gap={1}>
          <Text>URL:</Text>
          <TextInput
            value={url}
            onChange={setUrl}
            onSubmit={handleSubmit}
            placeholder="https://example.com/feed.xml"
          />
        </Box>

        {status && (
          <Text
            color={
              status.startsWith("Error")
                ? "red"
                : status.startsWith("Subscribed")
                  ? "green"
                  : "yellow"
            }
          >
            {status}
          </Text>
        )}

        {loading && <Text dimColor>Loading...</Text>}
      </Box>

      <Box flexGrow={1} />

      <StatusBar hints={["Enter:subscribe", "Esc:cancel"]} />
    </Box>
  )
}
