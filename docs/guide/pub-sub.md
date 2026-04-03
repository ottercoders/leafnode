# Pub/Sub

The Pub/Sub panel provides interactive publish, subscribe, and request/reply.

## Opening

Click the **radio tower** icon in the Streams view title bar, or run **Leafnode: Open Pub/Sub Panel** from the command palette.

## Subscribe Tab

- Enter a subject with wildcard support (`*`, `>`)
- Click **Subscribe** to start receiving messages
- Messages appear in a virtual-scrolled feed with color-coded subjects
- **Pause/Resume** — freeze the display without unsubscribing
- **Filter** — regex filter on subject or payload
- **Export** — save captured messages as JSON
- **Save** — bookmark subscriptions for quick re-use (star icon)

Multiple simultaneous subscriptions are supported, each color-coded.

## Publish Tab

- Enter a subject and payload
- Add custom headers
- Save frequently-used payloads as templates
- Templates persist across sessions

## Request Tab

- Send a request and view the response with round-trip timing
- Configurable timeout (default 5 seconds)
