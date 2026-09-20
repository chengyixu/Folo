# Folo RSS Service API Documentation

Folo provides a REST API that allows external services to manage RSS feeds and entries programmatically.

## Quick Start

```bash
# Start the server
folo --server-only

# Server runs at http://127.0.0.1:3847
```

## Configuration

| Option              | Default | Description     |
| ------------------- | ------- | --------------- |
| `--port, -p`        | 3847    | Server port     |
| `--server-only, -s` | false   | Run without TUI |

## API Endpoints

### Health Check

```bash
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-10T18:46:20.345Z"
}
```

---

## Feeds

### List All Feeds

```bash
GET /api/feeds
```

**Response:**

```json
[
  {
    "id": "GsVYYWh71ast4uxMi-oqm",
    "title": "/r/Technology",
    "url": "https://www.reddit.com/r/technology/.rss",
    "description": null,
    "image": null,
    "siteUrl": "https://www.reddit.com/r/technology/",
    "lastFetchedAt": "2026-01-10T18:46:12.263Z",
    "createdAt": "2026-01-10T18:46:11.000Z",
    "unreadCount": 25,
    "errorAt": null,
    "errorMessage": null
  }
]
```

### Get Feed by ID

```bash
GET /api/feeds/:id
```

### Subscribe to Feed (Add RSS Source)

```bash
POST /api/feeds
Content-Type: application/json

{
  "url": "https://example.com/feed.rss"
}
```

**Response:**

```json
{
  "feedId": "GsVYYWh71ast4uxMi-oqm",
  "newEntries": 25
}
```

**Example - Adding Reddit RSS:**

```bash
curl -X POST http://127.0.0.1:3847/api/feeds \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.reddit.com/r/programming/.rss"}'
```

**Example - Adding Hacker News:**

```bash
curl -X POST http://127.0.0.1:3847/api/feeds \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hnrss.org/newest"}'
```

### Unsubscribe from Feed

```bash
DELETE /api/feeds/:id
```

### Refresh Single Feed

```bash
POST /api/feeds/:id/refresh
```

### Refresh All Feeds

```bash
POST /api/feeds/refresh-all
```

---

## Entries

### List Entries

```bash
GET /api/entries
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `feedId` | string | Filter by feed ID |
| `unreadOnly` | boolean | Only return unread entries |
| `limit` | number | Max entries to return |
| `offset` | number | Pagination offset |

**Example:**

```bash
# Get all entries
curl http://127.0.0.1:3847/api/entries

# Get unread entries only
curl "http://127.0.0.1:3847/api/entries?unreadOnly=true"

# Get entries from specific feed
curl "http://127.0.0.1:3847/api/entries?feedId=GsVYYWh71ast4uxMi-oqm"

# Paginate results
curl "http://127.0.0.1:3847/api/entries?limit=10&offset=0"
```

### Get Entry by ID

```bash
GET /api/entries/:id
```

### Mark Entry as Read

```bash
POST /api/entries/:id/read
```

### Mark Entry as Unread

```bash
POST /api/entries/:id/unread
```

### Mark All as Read

```bash
POST /api/entries/mark-all-read
Content-Type: application/json

{
  "feedId": "optional-feed-id"
}
```

### Toggle Star

```bash
POST /api/entries/:id/toggle-star
```

### List Starred Entries

```bash
GET /api/entries/starred
```

---

## Statistics

```bash
GET /api/stats
```

**Response:**

```json
{
  "totalFeeds": 7,
  "totalEntries": 170,
  "unreadEntries": 165,
  "starredEntries": 2
}
```

---

## Integration Examples

### Python

```python
import requests

FOLO_URL = "http://127.0.0.1:3847"

# Add a feed
def add_feed(url):
    response = requests.post(
        f"{FOLO_URL}/api/feeds",
        json={"url": url}
    )
    return response.json()

# Get all entries
def get_entries(unread_only=False, limit=50):
    params = {"limit": limit}
    if unread_only:
        params["unreadOnly"] = "true"
    response = requests.get(f"{FOLO_URL}/api/entries", params=params)
    return response.json()

# Add Reddit feeds
add_feed("https://www.reddit.com/r/python/.rss")
add_feed("https://www.reddit.com/r/programming/.rss")

# Get unread entries
entries = get_entries(unread_only=True)
for entry in entries:
    print(f"{entry['title']} - {entry['url']}")
```

### Node.js / TypeScript

```typescript
const FOLO_URL = "http://127.0.0.1:3847"

// Add a feed
async function addFeed(url: string) {
  const response = await fetch(`${FOLO_URL}/api/feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  return response.json()
}

// Get entries
async function getEntries(options?: { feedId?: string; unreadOnly?: boolean; limit?: number }) {
  const params = new URLSearchParams()
  if (options?.feedId) params.set("feedId", options.feedId)
  if (options?.unreadOnly) params.set("unreadOnly", "true")
  if (options?.limit) params.set("limit", String(options.limit))

  const response = await fetch(`${FOLO_URL}/api/entries?${params}`)
  return response.json()
}

// Usage
await addFeed("https://www.reddit.com/r/typescript/.rss")
const entries = await getEntries({ unreadOnly: true, limit: 20 })
```

### Shell Script

```bash
#!/bin/bash
FOLO_URL="http://127.0.0.1:3847"

# Add multiple Reddit feeds
SUBREDDITS=("technology" "programming" "MachineLearning" "LocalLLaMA" "artificial")

for sub in "${SUBREDDITS[@]}"; do
  echo "Adding r/$sub..."
  curl -s -X POST "$FOLO_URL/api/feeds" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.reddit.com/r/$sub/.rss\"}"
  echo ""
done

echo "All feeds added!"
```

---

## Common RSS Sources

### Reddit

```
https://www.reddit.com/r/{subreddit}/.rss
https://www.reddit.com/r/{subreddit}/top/.rss
https://www.reddit.com/r/{subreddit}/new/.rss
```

### Hacker News

```
https://hnrss.org/newest
https://hnrss.org/frontpage
https://hnrss.org/best
```

### YouTube (via RSS)

```
https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}
```

### GitHub Releases

```
https://github.com/{owner}/{repo}/releases.atom
```

### Twitter (via RSSHub)

```
rsshub://twitter/user/{username}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Not Found",
  "message": "Feed not found",
  "statusCode": 404
}
```

Common status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

---

## Running as a Service

### Using systemd (Linux)

```ini
# /etc/systemd/system/folo.service
[Unit]
Description=Folo RSS Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/folo --server-only --port 3847
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

### Using launchd (macOS)

Build and install the repository-owned launch agent:

```bash
cd apps/terminal
pnpm build
pnpm install:launchd
```

The installer resolves the current Node binary and checkout path, writes
`~/Library/LaunchAgents/com.folo.terminal.plist`, starts it with `launchctl`, and
waits for `/api/health`.

Uninstall it with:

```bash
bash scripts/install-launch-agent.sh --uninstall
```

---

## Database

Folo Terminal stores data in SQLite at `~/.folo-terminal/folo.db` by default.
Set `FOLO_DATA_DIR` to use a different data directory, including for isolated tests.
