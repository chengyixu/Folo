/* eslint-disable unicorn/no-process-exit -- This file is the CLI process entrypoint. */
import { render } from "ink"
import * as React from "react"

import { initializeDatabase } from "./db/index.js"
import { startServer } from "./server/index.js"
import { App } from "./ui/index.js"

interface Options {
  port: number
  serverOnly: boolean
  help: boolean
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    port: 3847,
    serverOnly: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case "--help":
      case "-h": {
        options.help = true
        break
      }
      case "--server-only":
      case "-s": {
        options.serverOnly = true
        break
      }
      case "--port":
      case "-p": {
        const portString = args[++i]
        if (!portString) throw new Error("--port requires a numeric value")
        const port = Number.parseInt(portString, 10)
        if (Number.isNaN(port) || port <= 0 || port >= 65_536) {
          throw new Error(`Invalid port: ${portString}`)
        }
        options.port = port
        break
      }
    }
  }

  return options
}

function printHelp() {
  console.info(`
Folo Terminal - RSS Feed Reader

Usage: folo [options]

Options:
  -h, --help        Show this help message
  -s, --server-only Run only the HTTP server (no TUI)
  -p, --port <num>  Set the server port (default: 3847)

Keyboard Shortcuts (TUI mode):
  j/k or ↑/↓    Navigate up/down
  Enter or l    Open selected item
  h or Esc      Go back
  a             Add new feed
  r             Refresh current feed
  R             Refresh all feeds
  m             Toggle read status
  M             Mark all as read
  s             Toggle star
  o             Open in browser
  q             Quit

API Endpoints (server mode):
  GET    /api/health              Health check
  GET    /api/feeds               List all feeds
  GET    /api/feeds/:id           Get feed by ID
  POST   /api/feeds               Subscribe to feed (body: {url})
  DELETE /api/feeds/:id           Unsubscribe from feed
  POST   /api/feeds/:id/refresh   Refresh single feed
  POST   /api/feeds/refresh-all   Refresh all feeds
  GET    /api/entries             List entries (query: feedId, unreadOnly, limit, offset)
  GET    /api/entries/:id         Get entry by ID
  POST   /api/entries/:id/read    Mark entry as read
  POST   /api/entries/:id/unread  Mark entry as unread
  POST   /api/entries/mark-all-read  Mark all as read (body: {feedId?})
  POST   /api/entries/:id/toggle-star  Toggle star
  GET    /api/entries/starred     List starred entries
  GET    /api/stats               Get statistics
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    process.exit(0)
  }

  // Initialize database
  console.info("Initializing database...")
  initializeDatabase()

  // Start server. If the port is occupied, fail closed instead of killing an unrelated process.
  console.info(`Starting server on port ${options.port}...`)
  const server = await startServer(options.port)
  console.info(`Server running at http://127.0.0.1:${server.port}`)

  if (options.serverOnly) {
    console.info("\nRunning in server-only mode. Press Ctrl+C to stop.")
    let stopping = false
    const stopServer = async () => {
      if (stopping) return
      stopping = true
      console.info("\nShutting down...")
      await server.close()
      process.exit(0)
    }
    process.once("SIGINT", () => void stopServer())
    process.once("SIGTERM", () => void stopServer())
    return
  }

  // Clear console for TUI mode.
  process.stdout.write("\u001Bc")

  // Render TUI
  const { waitUntilExit } = render(
    <App
      onQuit={async () => {
        await server.close()
        process.exit(0)
      }}
    />,
  )

  await waitUntilExit()
  await server.close()
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
