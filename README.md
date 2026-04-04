# Leafnode

NATS observability and management for VS Code.

Browse JetStream streams, inspect messages, publish/subscribe in real time, manage KV stores, monitor server health, and more — all without leaving your editor. Works in local, SSH remote, WSL, Codespaces, and code-server environments.

## Features

- **Connection Manager** — Add, connect, and manage multiple NATS servers. Import existing NATS CLI contexts or auto-detect the `NATS_URL` environment variable. Export and import connections as JSON for easy sharing. Health check with RTT display. Supports anonymous, token, user/password, NKey, credentials file, and TLS certificate auth. Credentials stored securely via VS Code SecretStorage.

- **Stream Explorer** — Browse JetStream streams with message counts, byte sizes, real-time message rates, and consumer details. Visualize mirror and source stream relationships. Compare stream configs with the built-in diff editor. Create, edit, duplicate, seal, purge, and delete streams. Full consumer lifecycle management with pause/resume support and message pull for debugging.

- **Message Browser** — Inspect messages by sequence range or time range. Filter by subject pattern. Search message payloads by text. Republish messages to a different subject. View headers and JSON-formatted payloads in a virtual-scrolled list. Bookmark messages for quick access.

- **Pub/Sub Panel** — Subscribe to subjects with wildcard support and view live message feeds with color-coded subjects and real-time rate indicators. Publish messages with custom headers. Send request/reply with configurable timeouts. Filter messages with regex. Save subscriptions and publish templates. Export captured messages as JSON.

- **KV Browser** — Browse Key-Value store buckets and keys in the sidebar. View, edit, and save key values with JSON formatting. Inspect key revision history. Watch keys for real-time updates with toast notifications on changes. Create and delete buckets and keys.

- **Object Stores** — Browse NATS Object Store contents with metadata viewer.

- **Subject Explorer** — Hierarchical tree view of the NATS subject namespace, built from stream subject bindings.

- **Server Monitoring** — Dashboard with real-time server stats (varz), active connections table (connz), JetStream metrics (jsz), and account listing. Auto-refreshes with sparkline charts.

- **Bookmarks** — Save frequently-used subscriptions, publish templates, and message bookmarks for quick access across sessions.

- **NATS CLI Integration** — Run common NATS CLI commands from the VS Code command palette.

- **Workspace Configuration** — Share connection settings via `.leafnode.json` with JSON Schema validation and IntelliSense.

- **Keyboard Shortcuts** — Quick access to common actions: `Ctrl+Shift+Alt+N` (add connection), `Ctrl+Shift+Alt+M` (pub/sub), `Ctrl+Shift+Alt+J` (server monitor).

## Quick Start

1. Install the extension
2. Click the NATS icon in the Activity Bar
3. Click "Add Connection" or "Import from NATS CLI"
4. Enter your server URL (default: `nats://localhost:4222`)
5. Connect and start exploring

## Requirements

- A running NATS server (with JetStream enabled for stream/KV features)
- VS Code 1.95.0 or later

## Documentation

Full documentation available at [ottercoders.github.io/leafnode](https://ottercoders.github.io/leafnode/).

## Architecture

Leafnode runs as a **workspace extension** — it executes on the same machine as your workspace (local or remote). All NATS communication uses TCP from the extension host via `@nats-io/transport-node`. This means it works seamlessly in remote development environments where the NATS server is accessible from the remote host.

## License

MIT
