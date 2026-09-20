import { Box, Text, useInput, useStdout } from "ink"
import * as React from "react"
import { useCallback, useEffect, useState } from "react"

import type { EntrySchema, FeedSchema } from "../../db/schema.js"
import { EntryService } from "../../services/entry.js"
import { Header, StatusBar } from "../components/index.js"

interface EntryViewProps {
  entryId: string
  onBack: () => void
  onOpenInBrowser: (url: string) => void
}

function stripHtml(html: string): string {
  return html
    .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\n\s*\n\s*\n/g, "\n\n")
    .trim()
}

export function EntryView({ entryId, onBack, onOpenInBrowser }: EntryViewProps) {
  const [entry, setEntry] = useState<EntrySchema | null>(null)
  const [feed, setFeed] = useState<FeedSchema | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const { stdout } = useStdout()
  const terminalHeight = stdout?.rows ?? 24

  const loadEntry = useCallback(async () => {
    setLoading(true)
    try {
      const result = await EntryService.getById(entryId)
      if (result) {
        setEntry(result.entry)
        setFeed(result.feed)
        if (!result.entry.read) {
          await EntryService.markAsRead(entryId)
        }
      }
    } catch (error) {
      console.error("Error loading entry:", error)
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    void loadEntry()
  }, [loadEntry])

  useInput((input, key) => {
    if (loading) return

    if (key.upArrow || input === "k") {
      setScrollOffset((o) => Math.max(0, o - 1))
    } else if (key.downArrow || input === "j") {
      setScrollOffset((o) => o + 1)
    } else if (key.pageUp) {
      setScrollOffset((o) => Math.max(0, o - 10))
    } else if (key.pageDown) {
      setScrollOffset((o) => o + 10)
    } else if (key.escape || input === "h" || input === "q") {
      onBack()
    } else if (input === "o") {
      if (entry?.url) {
        onOpenInBrowser(entry.url)
      }
    } else if (input === "s" && entry) {
      EntryService.toggleStarred(entry.id)
      loadEntry()
    }
  })

  if (loading) {
    return (
      <Box flexDirection="column" height="100%">
        <Header title="Loading..." />
        <Text>Loading entry...</Text>
      </Box>
    )
  }

  if (!entry) {
    return (
      <Box flexDirection="column" height="100%">
        <Header title="Error" />
        <Text color="red">Entry not found</Text>
      </Box>
    )
  }

  const content = stripHtml(entry.content || entry.description || "")
  const lines = content.split("\n")
  const visibleLines = lines
    .slice(scrollOffset, scrollOffset + terminalHeight - 10)
    .map((content, index) => ({ content, lineNumber: scrollOffset + index }))

  const formatDate = (date: Date) => {
    return date.toLocaleString()
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header
        title={entry.title || "(No title)"}
        subtitle={`${feed?.title || "Unknown feed"} · ${entry.author || "Unknown author"} · ${formatDate(entry.publishedAt)}`}
      />

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1} overflow="hidden">
        {entry.starred && <Text color="yellow">★ Starred</Text>}

        <Box flexDirection="column" marginTop={1}>
          {visibleLines.map(({ content: line, lineNumber }) => (
            <Text key={lineNumber} wrap="wrap">
              {line}
            </Text>
          ))}
        </Box>

        {scrollOffset > 0 && (
          <Box position="absolute" marginTop={0}>
            <Text dimColor>↑ More above</Text>
          </Box>
        )}

        {scrollOffset + terminalHeight - 10 < lines.length && (
          <Text dimColor>
            ↓ More below ({lines.length - scrollOffset - terminalHeight + 10} lines)
          </Text>
        )}
      </Box>

      <StatusBar
        hints={[
          "↑↓/jk:scroll",
          "PgUp/PgDn:fast scroll",
          "h/Esc:back",
          "o:open in browser",
          "s:star",
        ]}
      />
    </Box>
  )
}
