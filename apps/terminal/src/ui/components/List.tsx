import { Box, Text } from "ink"
import * as React from "react"

interface ListItem {
  id: string
  label: string
  secondary?: string
  badge?: string | number
  isUnread?: boolean
}

interface ListProps {
  items: ListItem[]
  selectedIndex: number
  emptyMessage?: string
}

export function List({ items, selectedIndex, emptyMessage = "No items" }: ListProps) {
  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isSelected = index === selectedIndex
        return (
          <Box key={item.id} gap={1}>
            <Text color={isSelected ? "cyan" : undefined}>{isSelected ? "❯" : " "}</Text>
            <Box flexGrow={1}>
              <Text bold={item.isUnread} color={isSelected ? "cyan" : undefined} wrap="truncate">
                {item.label}
              </Text>
            </Box>
            {item.secondary && (
              <Text dimColor wrap="truncate">
                {item.secondary}
              </Text>
            )}
            {item.badge !== undefined && item.badge !== 0 && (
              <Text color="yellow">({item.badge})</Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
