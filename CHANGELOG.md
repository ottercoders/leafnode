# Changelog

## 0.1.0

Initial release.

### Features

- **Connection Manager** — Add, edit, remove, and manage NATS server connections. Supports anonymous, token, user/password, NKey, credentials file, and TLS client certificate authentication. Import existing NATS CLI contexts. Credentials stored securely via VS Code SecretStorage.
- **Stream Explorer** — Browse JetStream streams with message counts, byte sizes, and consumer details. Purge and delete streams from the context menu.
- **Message Browser** — Inspect stream messages by sequence range or subject filter. View headers and payloads with auto-detected JSON formatting. Navigate with first/prev/next and jump-to-sequence controls.
- **Pub/Sub Panel** — Subscribe to subjects with wildcard support and view live message feeds. Publish messages with custom headers. Send request/reply with configurable timeouts.
- **KV Browser** — Browse Key-Value store buckets and keys in the sidebar. View, edit, and save key values. Inspect key revision history. Create and delete buckets and keys.
- **Remote Compatible** — Works in local, SSH remote, WSL, Codespaces, and code-server environments.
