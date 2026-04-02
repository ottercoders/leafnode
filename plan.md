# Leafnode — VS Code Extension for NATS

## Vision

Leafnode is a VS Code extension that brings full NATS observability and management into the editor. It targets developers who build on NATS daily and need to inspect streams, debug message flows, manage KV stores, and monitor server health — all without leaving VS Code. It must work everywhere VS Code Server runs: local, SSH remotes, WSL, Codespaces, code-server, and Cursor.

---

## Competitive Analysis

### Qaze (Desktop, Closed-Source, Paid)

| Area | Coverage | Notes |
|------|----------|-------|
| Streams | Full | Create, edit, duplicate, purge, seal, delete. Message browsing with live-tail and history. Reusable filters. |
| Consumers | Full | View lag, config, state. |
| KV Stores | Full | Browse, search, manage buckets and entries. |
| Object Stores | Full | File-browser UI, upload/download with progress. |
| Pub/Sub | Partial | No ad-hoc subscribe/publish debugging panel. |
| Request/Reply | No | — |
| Services | Full | Instance monitoring, response times, error rates, throughput, handler stats. |
| Server Monitoring | Full | Health metrics, cluster topology, leaf nodes, gateways. |
| Auth | Good | Reuses NATS CLI contexts, NSC integration. |
| Multi-Connection | Yes | — |
| Deployment | Desktop only | macOS, Windows, Linux via Tauri. No web, no embedded. |
| Extensibility | None | Closed source, no plugin API. |
| Cost | Paid | 14-day trial, then license required. |

**Strengths:** Most feature-complete NATS GUI. Low memory (Tauri). Polished UX.
**Weaknesses:** Closed source, paid, desktop-only, no pub/sub debugging, no VS Code integration.

### NUI (Desktop + Docker, Open-Source, Free)

| Area | Coverage | Notes |
|------|----------|-------|
| Streams | Good | View/modify config, message viewing with filtering, purge/delete. |
| Consumers | Good | Management, create/delete. |
| KV Stores | Good | Bucket management, entry viewing/filtering/editing, key history. |
| Object Stores | No | Not implemented. |
| Pub/Sub | Good | Subscribe to subjects, publish messages (text, JSON, hex, protobuf). |
| Request/Reply | Yes | Send requests, view responses. |
| Services | No | Not implemented. |
| Server Monitoring | No | On roadmap. |
| Auth | Good | All main NATS auth patterns. |
| Multi-Connection | Yes | Simultaneous connections to multiple servers. |
| Deployment | Desktop + Docker | Wails.io desktop, experimental Helm chart. |
| Extensibility | Fork | Unlicense, fully open source. |
| Cost | Free | — |

**Strengths:** Free, open source, good pub/sub and stream management, active development.
**Weaknesses:** No object stores, no services monitoring, no server metrics, no VS Code integration.

### Existing VS Code Extensions

| Extension | Installs | Last Updated | Scope |
|-----------|----------|--------------|-------|
| bitswar/nats-vscode | 183 | Sep 2025 | `.nats` file CodeLens: subscribe, publish, request |
| Zap Nats Client | 657 | Nov 2023 (dormant) | `.nats.md` publish-only |
| vscode-nats-client | Unreleased | — | Most capable: CodeLens + JetStream publish/consume, but file-based only, no tree views |

**The VS Code NATS space is effectively empty.** No extension provides tree-based exploration, stream management, KV browsing, or server monitoring.

### Leafnode Differentiation

| Capability | Qaze | NUI | Existing Extensions | Leafnode (Planned) |
|------------|------|-----|--------------------|--------------------|
| VS Code native | — | — | Minimal | Full |
| Remote-compatible | — | — | Unknown | First-class |
| Stream explorer | Yes | Yes | — | Yes |
| Consumer management | Yes | Yes | — | Yes |
| KV browser + editor | Yes | Yes | — | Yes |
| Object store browser | Yes | — | — | Yes |
| Pub/Sub debugging | Partial | Yes | Basic | Yes |
| Request/Reply | — | Yes | Basic | Yes |
| Message schema decode | — | Partial | — | Yes (JSON, Protobuf, MessagePack) |
| Services monitoring | Yes | — | — | Yes |
| Server monitoring | Yes | — | — | Yes |
| Cluster topology | Yes | — | — | Yes |
| Free + open source | — | Yes | Yes | Yes |
| Multi-connection | Yes | Yes | Limited | Yes |
| NATS CLI context reuse | Yes | — | — | Yes |

---

## Architecture

### Extension Host Model

```
┌─────────────────────────────────────────────────────────┐
│  VS Code UI (local or remote)                           │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Tree Views   │  │  Webview      │  │  Editor       │ │
│  │  (native)     │  │  Panels       │  │  Integration  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         │     postMessage  │                  │          │
│         ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Extension Host (Node.js)                        │    │
│  │                                                   │    │
│  │  ┌─────────────┐  ┌──────────────┐               │    │
│  │  │ Connection   │  │ NATS Service  │               │    │
│  │  │ Manager      │──│ Layer         │               │    │
│  │  └─────────────┘  └──────┬───────┘               │    │
│  └──────────────────────────┼───────────────────────┘    │
│                              │                            │
└──────────────────────────────┼────────────────────────────┘
                               │ TCP (@nats-io/transport-node)
                               ▼
                    ┌─────────────────────┐
                    │  NATS Server(s)      │
                    │  (4222 client)       │
                    │  (8222 monitoring)   │
                    └─────────────────────┘
```

### Key Architectural Decisions

1. **Workspace extension** (`extensionKind: ["workspace"]`). Runs on the remote machine where NATS is reachable over the local network. This is what makes it work in SSH, WSL, Codespaces, and code-server.

2. **TCP from extension host, not WebSocket from webviews.** Webviews render in the local browser — `localhost` resolves to the user's machine, not the remote. VS Code issue #188008 confirms WebSocket from webviews to remote servers is broken. All NATS I/O goes through the extension host via `@nats-io/transport-node`.

3. **Tree views for navigation, webview panels for rich content.** Tree views are native, performant, accessible, and theme-aware. Webview panels handle complex UIs (message inspection, live monitoring, config editing) and communicate with the extension host via `postMessage`.

4. **Pure TypeScript, zero native modules.** The `@nats-io/transport-node` package and all NATS JS modules are pure JS/TS. No compilation, no architecture-specific binaries, works on ARM and x86.

5. **NATS CLI context reuse.** Read `~/.config/nats/context/` files to import existing server configurations and credentials. Users who already have NATS CLI set up get instant value.

6. **Secrets API for credentials.** Tokens, passwords, NKeys, and credential file contents stored via VS Code's `SecretStorage` API — never in plaintext settings.

### NATS Client Stack

| Package | Purpose |
|---------|---------|
| `@nats-io/transport-node` | TCP transport + re-exports core |
| `@nats-io/jetstream` | Stream and consumer operations |
| `@nats-io/kv` | Key-Value store API |
| `@nats-io/obj` | Object Store API |
| `@nats-io/services` | Services discovery and monitoring |

All v3.x, modular, same `NatsConnection` interface.

### Project Structure (Proposed)

```
leafnode/
├── .vscode/                    # Extension development settings
├── src/
│   ├── extension.ts            # Activation, command/view registration
│   ├── connections/
│   │   ├── manager.ts          # Connection lifecycle, pooling, reconnect
│   │   ├── config.ts           # Connection configuration types
│   │   ├── context-import.ts   # NATS CLI context file parser
│   │   └── auth.ts             # Auth strategy handling (token, NKey, creds, TLS)
│   ├── services/
│   │   ├── nats.ts             # Core NATS operations (pub/sub/request)
│   │   ├── jetstream.ts        # Stream and consumer CRUD
│   │   ├── kv.ts               # KV bucket and entry operations
│   │   ├── object-store.ts     # Object store operations
│   │   ├── monitoring.ts       # HTTP monitoring API client (varz, connz, etc.)
│   │   └── services.ts         # NATS services discovery
│   ├── views/
│   │   ├── trees/
│   │   │   ├── connections.ts  # Connection list tree provider
│   │   │   ├── streams.ts      # Streams + consumers tree provider
│   │   │   ├── kv.ts           # KV buckets + keys tree provider
│   │   │   ├── objects.ts      # Object stores tree provider
│   │   │   └── subjects.ts     # Subject hierarchy tree provider
│   │   └── webviews/
│   │       ├── message-inspector/   # Message detail view
│   │       ├── pub-sub-panel/       # Interactive pub/sub debugging
│   │       ├── stream-config/       # Stream create/edit form
│   │       ├── kv-editor/           # KV entry editor
│   │       ├── monitoring/          # Server dashboard
│   │       └── shared/              # Shared webview utilities, theme bridge
│   ├── editors/
│   │   └── nats-message.ts    # Custom editor provider for message payloads
│   └── utils/
│       ├── codec.ts            # Message decode (JSON, Protobuf, MsgPack, raw)
│       ├── subject.ts          # Subject parsing, wildcard matching
│       └── format.ts           # Byte formatting, date formatting, duration
├── webview-ui/                 # Webview frontend (built separately)
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── panels/             # Panel-specific UIs
│   │   └── lib/                # Utilities, state management
│   ├── package.json
│   └── vite.config.ts
├── test/
│   ├── unit/
│   ├── integration/            # Tests against real NATS server
│   └── fixtures/
├── resources/                  # Icons, static assets
├── package.json                # Extension manifest
├── tsconfig.json
└── esbuild.config.ts           # Bundle extension host code
```

### Webview Technology

- **Framework:** Svelte 5 (lightweight, compiles away, small bundle size — ideal for webviews)
- **Build:** Vite for webview UI, esbuild for extension host
- **Styling:** VS Code CSS variables for theme integration (`--vscode-editor-background`, etc.)
- **State:** Svelte stores + message passing bridge to extension host
- **Alternative considered:** React (heavier, larger bundle, but more ecosystem). Svelte wins on bundle size which matters for webview load time.

---

## Feature Plan

### Tier 1 — Core (MVP)

The minimum set of features to be genuinely useful as a daily NATS development tool.

#### 1.1 Connection Manager

**Tree view:** Sidebar panel listing saved connections with status indicators (connected/disconnected/error).

- Add connection: server URL(s), name, optional auth
- Edit / delete connections
- Connect / disconnect toggle
- Auto-reconnect with backoff
- Connection status in status bar
- Import from NATS CLI contexts (`~/.config/nats/context/*.json`)
- Auth methods: anonymous, token, user/password, NKey, credentials file, TLS client cert
- Multi-server URLs (for cluster failover)
- Store credentials in VS Code SecretStorage

**Commands:**
- `leafnode.addConnection`
- `leafnode.editConnection`
- `leafnode.removeConnection`
- `leafnode.connect`
- `leafnode.disconnect`
- `leafnode.importNatsContext`

#### 1.2 Stream Explorer

**Tree view:** Hierarchical list of JetStream streams under each connection.

```
Connection: local-dev
  └── Streams
      ├── ORDERS (52,341 msgs, 128MB)
      │   ├── Consumers
      │   │   ├── order-processor (lag: 12)
      │   │   └── audit-logger (lag: 0)
      │   └── Subjects: ORDERS.>
      ├── EVENTS (1,204,556 msgs, 2.1GB)
      └── NOTIFICATIONS (891 msgs, 4MB)
```

- Stream list with message count, byte size, subject filter
- Expand stream to see consumers, subjects, config summary
- Click stream to open detail webview (full config, state, limits)
- Context menu: purge stream, delete stream
- Consumer detail: config, ack floor, num pending, num redelivered
- Refresh on demand + configurable auto-refresh interval

#### 1.3 Message Browser

**Webview panel:** Browse messages within a stream.

- Browse by sequence range or time range
- Filter by subject within stream
- Message list: sequence, subject, timestamp, size
- Message detail: headers (table), payload with auto-detected formatting
- Payload rendering: raw bytes (hex), UTF-8 text, JSON (pretty-printed + collapsible), base64
- Copy message payload, headers, or full message
- Navigate: first, last, next, previous, jump to sequence
- Click subject to start a subscription on that subject

#### 1.4 Pub/Sub Panel

**Webview panel:** Interactive publish and subscribe interface.

- **Subscribe tab:**
  - Subject input with wildcard support (`*`, `>`)
  - Live message stream (virtual-scrolled for performance)
  - Each message shows: subject, timestamp, size, payload preview
  - Click message to expand full detail
  - Pause/resume subscription
  - Clear messages
  - Filter incoming messages by regex on subject or payload
  - Multiple simultaneous subscriptions (tabbed or color-coded)

- **Publish tab:**
  - Subject input
  - Headers editor (key-value pairs)
  - Payload editor with syntax highlighting (JSON, plain text)
  - Payload templates (save/load frequently-used messages)
  - Publish button + keyboard shortcut
  - Reply-to field (optional)

- **Request/Reply tab:**
  - Subject, headers, payload (same as publish)
  - Timeout configuration
  - Response display with timing information
  - History of recent requests

#### 1.5 KV Browser

**Tree view + webview:**

```
Connection: local-dev
  └── KV Stores
      ├── config (42 keys)
      ├── sessions (1,208 keys)
      └── feature-flags (18 keys)
```

- Bucket list with key count
- Expand bucket to list keys (paginated for large buckets)
- Click key to view value in webview editor
- Value display: auto-detect JSON, raw text, binary (hex dump)
- Edit value in-place (text/JSON editor)
- Key history: view all revisions with timestamps and operations (PUT/DEL/PURGE)
- Create new key-value pair
- Delete key, purge key (remove history)
- Create / delete bucket with config (history depth, TTL, max bytes, replicas)
- Watch mode: real-time updates as keys change (highlight changed keys in tree)

---

### Tier 2 — Power User

Features for deeper NATS management and debugging workflows.

#### 2.1 Consumer Management

- Create new consumer (durable or ephemeral) with full config UI
- Edit consumer configuration
- Delete consumer
- View consumer state: ack floor, num pending, num waiting, num redelivered
- Pause / resume consumer (NATS 2.11+)
- Consumer lag visualization (bar/sparkline)
- Pull next N messages from a consumer (for debugging)

#### 2.2 Stream Management

- Create new stream with full config UI (subjects, retention, limits, storage, replicas, sources, mirrors)
- Edit stream configuration
- Duplicate stream config (clone settings to new stream)
- Purge stream (all messages, or by subject, or by sequence)
- Seal stream (make read-only)
- Delete stream (with confirmation)
- Stream state visualization: message rate, byte rate, consumer lag overview

#### 2.3 Object Store Browser

**Tree view + webview:**

```
Connection: local-dev
  └── Object Stores
      ├── attachments (156 objects, 2.3GB)
      └── templates (23 objects, 45MB)
```

- Store list with object count and total size
- Object list: name, size, chunks, last modified, digest
- Download object to local filesystem
- Upload file from local filesystem
- Delete object
- Object metadata viewer
- Watch for changes

#### 2.4 Real-Time Message Tailing

An enhanced subscription view optimized for debugging:

- Tail multiple subjects simultaneously in a unified timeline
- Color-coded by subject pattern
- Rate indicator (msgs/sec)
- Auto-pause when scrolling back, resume when scrolling to bottom
- Regex-based payload highlighting (highlight matching text in payloads)
- Message diffing: compare two messages side-by-side
- Export captured messages to JSON/NDJSON file

#### 2.5 Subject Explorer

**Tree view:** Hierarchical visualization of the subject namespace.

```
Connection: local-dev
  └── Subjects
      ├── ORDERS
      │   ├── created (2 subscribers)
      │   ├── updated (1 subscriber)
      │   └── deleted (1 subscriber)
      ├── EVENTS
      │   ├── user
      │   │   ├── login
      │   │   └── logout
      │   └── system
      └── NOTIFICATIONS
```

- Built from active subscriptions and stream subject filters
- Show subscriber count per subject (from server connz/subsz data)
- Click subject to subscribe
- Right-click to publish to subject

#### 2.6 Message Schema Support

- Auto-detect JSON and pretty-print with syntax highlighting
- Protobuf decode: load `.proto` files, decode message payloads against known schemas
- MessagePack decode
- CloudEvents format recognition and structured display
- Schema registry: associate subjects with schemas for automatic decode
- JSON Schema validation: validate payloads against JSON Schema definitions

#### 2.7 Saved Queries and Bookmarks

- Save frequently-used subscriptions (subject + filters)
- Save publish templates (subject + headers + payload)
- Save request templates
- Bookmark specific messages by stream + sequence number
- Organize bookmarks in folders
- Share bookmarks via `.leafnode.json` workspace file (version-controllable)

---

### Tier 3 — Operations & Monitoring

Features for operations teams and production debugging.

#### 3.1 Server Monitoring Dashboard

**Webview panel:** Dashboard built from NATS HTTP monitoring endpoints.

- **Server info (varz):** version, uptime, CPU/memory usage, connections, slow consumers, in/out msgs/bytes rates
- **Connections (connz):** active connections table with sort/filter, per-connection message rates, identify slow consumers
- **JetStream info (jsz):** total streams/consumers, storage used, API stats (calls, errors)
- Auto-refresh interval (configurable)
- Sparkline charts for key metrics over time (in-memory, last N minutes)
- Alerts: highlight when metrics cross thresholds (configurable)

Requires HTTP monitoring port (default 8222). Connection config includes optional monitoring URL.

#### 3.2 Cluster Topology View

**Webview panel:** Visual representation of cluster state.

- **Routes (routez):** cluster node connections, visualized as a graph
- **Gateways (gatewayz):** supercluster connections between clusters
- **Leaf nodes (leafz):** leaf node connections with account info
- Node health indicators
- Click node for detail panel

#### 3.3 Services Discovery & Monitoring

- Discover NATS microservices via the services protocol
- List services with version, description, metadata
- Per-service stats: total requests, errors, average processing time
- Per-endpoint breakdown
- Service health timeline

#### 3.4 Account & Auth Monitoring

- Account info (accountz): list accounts, limits, JetStream usage
- Per-account stats (accstatz): connections, message rates, data rates
- Subscription routing info (subsz): subscription tree depth, fan-out

---

### Tier 4 — Developer Experience & Integration

Features that integrate NATS deeper into the VS Code development workflow.

#### 4.1 NATS Configuration Language Support

- Syntax highlighting for NATS server config files (`.conf`)
- Validation and diagnostics for NATS config
- Hover documentation for config directives
- Auto-completion for known config fields

#### 4.2 Code Integration

- **CodeLens for Go/TypeScript/Python:** Detect `nc.Publish("ORDERS.created", ...)` calls in code and show "Subscribe to ORDERS.created" / "Publish to ORDERS.created" actions inline
- **Go-to-stream:** Click a subject string literal to jump to the stream that captures it
- **Hover info:** Hover over a subject string to see which streams capture it and current message count

#### 4.3 NATS CLI Integration

- Run NATS CLI commands from VS Code command palette
- Output captured in VS Code terminal or output channel
- Quick-pick for common operations: `nats stream ls`, `nats sub`, `nats pub`
- Import/export NATS CLI contexts

#### 4.4 Testing Support

- Publish test messages from test fixtures
- Record and replay message sequences
- Assert on received messages (for integration test debugging)
- Snapshot: capture all messages on a set of subjects over a time window, save to file for comparison

#### 4.5 Workspace Configuration

`.leafnode.json` in workspace root:

```jsonc
{
  "connections": [
    {
      "name": "local-dev",
      "servers": ["nats://localhost:4222"],
      "monitoringUrl": "http://localhost:8222"
    }
  ],
  "bookmarks": [...],
  "publishTemplates": [...],
  "subjectSchemas": {
    "ORDERS.>": "./schemas/order.proto",
    "EVENTS.>": "./schemas/event.schema.json"
  }
}
```

- Shareable across the team via version control
- Connection details (without secrets) for the workspace
- Subject-to-schema mappings
- Saved bookmarks and templates

---

## UI/UX Design Principles

1. **Tree-first navigation.** The sidebar tree views are the primary entry point. Every NATS entity (connection, stream, consumer, bucket, key) is reachable from the tree. Webviews open for detail/interaction.

2. **Zero-config quickstart.** Connect to `localhost:4222` with one click. Import NATS CLI contexts for existing setups. No config files required to start.

3. **Follow VS Code conventions.** Use standard iconography (codicons), standard context menus, standard keybindings. The extension should feel native, not like an embedded web app.

4. **Progressive disclosure.** Show the most important info by default (message count, consumer lag). Full details are one click away. Advanced config is behind "Advanced" sections.

5. **Performance-conscious.** Virtual scroll for large message lists. Paginate large KV key lists. Debounce refresh. Don't block the UI on slow NATS operations.

6. **Theme-aware.** All webview UIs use VS Code CSS variables. Works with any color theme including high contrast.

---

## Technical Constraints & Considerations

### Remote Compatibility Matrix

| Environment | Extension Host | NATS TCP | HTTP Monitoring | Webviews |
|-------------|---------------|----------|-----------------|----------|
| Local | Local Node.js | Direct | Direct | Local render |
| SSH Remote | Remote Node.js | Direct from remote | Direct from remote | Local render, postMessage |
| WSL | WSL Node.js | Direct from WSL | Direct from WSL | Windows render, postMessage |
| Codespaces | Codespace Node.js | Direct from codespace | Direct from codespace | Browser render, postMessage |
| code-server | Server Node.js | Direct from server | Direct from server | Browser render, postMessage |
| Cursor | Same as VS Code | Same | Same | Same |

All NATS operations go through the extension host. Webviews never connect to NATS directly.

### Performance Targets

- Tree view refresh: < 200ms for up to 1000 streams
- Message browser: virtual scroll, load 50 messages at a time, < 100ms per page
- Pub/Sub live view: handle 10,000 msgs/sec display rate (batch UI updates at 60fps)
- Extension activation: < 500ms
- Extension bundle size: < 2MB (esbuild tree-shaking)

### Security

- Credentials never stored in plaintext settings — always SecretStorage
- TLS client certificates supported
- NKey signing handled in-process (no shell-out)
- No telemetry, no external network calls beyond NATS connections the user configures
- Workspace `.leafnode.json` never contains secrets

---

## Development Phases

### Phase 1: Foundation (Tier 1 MVP)

**Goal:** A usable NATS explorer that people actually want to install.

1. Project scaffolding (extension manifest, build pipeline, test setup)
2. Connection manager (add/connect/disconnect, SecretStorage, CLI context import)
3. Stream explorer tree view
4. Message browser webview
5. Pub/Sub panel webview
6. KV browser (tree + webview editor)
7. Extension marketplace listing, icon, README

**Exit criteria:** Can connect to a NATS server, browse streams and messages, publish/subscribe, browse/edit KV — in local and remote environments.

### Phase 2: Management (Tier 2)

**Goal:** Full NATS management without leaving VS Code.

1. Consumer management CRUD
2. Stream management CRUD
3. Object store browser
4. Real-time message tailing
5. Subject explorer
6. Message schema support (JSON, Protobuf)
7. Saved queries and bookmarks

**Exit criteria:** Feature parity with NUI, plus schema decode and bookmarks.

### Phase 3: Operations (Tier 3)

**Goal:** Production monitoring and debugging.

1. Server monitoring dashboard (varz, connz, jsz)
2. Cluster topology visualization
3. Services discovery and monitoring
4. Account monitoring

**Exit criteria:** Covers monitoring use cases that currently require switching to Qaze or the NATS CLI.

### Phase 4: Integration (Tier 4)

**Goal:** Deep VS Code integration that no standalone tool can match.

1. NATS config file language support
2. CodeLens for subject strings in code
3. NATS CLI integration
4. Testing support
5. Workspace configuration sharing

**Exit criteria:** NATS-aware code editing features that justify having this in VS Code rather than a standalone app.

---

## Open Questions

1. **Webview framework:** Svelte 5 is proposed for small bundle size. Worth evaluating Lit or vanilla web components as lighter alternatives? React is heavier but has more VS Code webview examples in the wild.
2. **Protobuf support:** Ship `protobufjs` as a dependency, or shell out to `protoc`? The former is more portable but adds bundle size.
3. **NATS monitoring API auth:** The HTTP monitoring endpoints may be behind auth or not exposed at all. How gracefully should we degrade when monitoring is unavailable?
4. **Extension size budget:** VS Code marketplace has a 20MB limit for VSIX packages. Protobuf support + webview bundles could get heavy. May need to make some features optional or lazy-loaded.
5. **Testing strategy:** Unit tests for service layer, integration tests against a real NATS server (via testcontainers or nats-server binary in CI). How much E2E webview testing is practical?
