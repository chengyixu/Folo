import { Box, Text } from "ink"
import * as React from "react"

interface StatusBarProps {
  message?: string
  hints: string[]
}

export function StatusBar({ message, hints }: StatusBarProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {message && <Text color="yellow">{message}</Text>}
      <Box gap={2}>
        {hints.map((hint) => (
          <Text key={hint} dimColor>
            {hint}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
