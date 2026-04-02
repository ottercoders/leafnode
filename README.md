# Leafnode

NATS observability and management for VS Code.

Browse JetStream streams, inspect messages, publish/subscribe in real time, and manage KV stores — all without leaving your editor. Works in local, SSH remote, WSL, Codespaces, and code-server environments.

## Features

- **Connection Manager** — Add, connect, and manage multiple NATS servers. Import existing NATS CLI contexts. Credentials stored securely via VS Code SecretStorage.
- **Stream Explorer** — Browse JetStream streams with message counts, byte sizes, and consumer lag. Expand streams to see consumers and subject bindings.
- **Message Browser** — Inspect messages by sequence range or subject filter. View headers and payloads with auto-detected JSON formatting.
- **Pub/Sub Panel** — Subscribe to subjects with wildcard support, publish messages with headers, and send request/reply — all in an interactive panel.
- **KV Browser** — Browse Key-Value store buckets and keys in the sidebar tree. View, edit, and inspect key history in a dedicated editor panel.

## Quick Start

1. Install the extension
2. Click the NATS icon in the Activity Bar
3. Click "Add Connection" or "Import from NATS CLI"
4. Enter your server URL (default: `nats://localhost:4222`)
5. Connect and start exploring

## Requirements

- A running NATS server (with JetStream enabled for stream/KV features)
- VS Code 1.95.0 or later

## Architecture

Leafnode runs as a **workspace extension** — it executes on the same machine as your workspace (local or remote). All NATS communication uses TCP from the extension host via `@nats-io/transport-node`. This means it works seamlessly in remote development environments where the NATS server is accessible from the remote host.

## License

MIT
