# Leafnode

VS Code extension for NATS observability and management. Workspace extension (`extensionKind: ["workspace"]`) that runs on the remote machine where NATS is reachable.

## Build & Test

```bash
npm install                    # root dependencies
cd webview-ui && npm install   # webview dependencies (separate, not npm workspaces)
cd ..

npm run build                  # builds webview (Vite) then extension (esbuild)
npm run build:ext              # extension host only
npm run build:webview          # webview UI only
npm run watch                  # watch both in parallel

npm run typecheck              # tsc --noEmit
npm run lint                   # eslint src/
npm run test                   # vitest unit tests
npm run test:integration       # vitest integration tests (requires nats-server on localhost:4222)
npm run package                # vsce package --no-dependencies → .vsix
```

F5 in VS Code launches the Extension Development Host (requires `npm run watch` running).

## Architecture

- **Extension host** (Node.js): esbuild bundles `src/extension.ts` → `dist/extension.js` (CJS). All NATS I/O happens here via TCP (`@nats-io/transport-node`). `vscode` is externalized.
- **Webview UI** (browser): Svelte 5 + Vite builds `webview-ui/src/panels/*/` → `dist/webview/`. Five panels: `message-browser`, `pub-sub`, `kv-editor`, `obj-viewer`, `server-monitor`. Communicates with extension host via `postMessage`.
- **Tree views**: Native VS Code tree data providers for connections, streams, KV stores, object stores, and subjects.

Webviews never connect to NATS directly — all data flows through the extension host via the `WebviewMessageRouter`.

## Key Source Paths

| Path | Purpose |
|------|---------|
| `src/extension.ts` | Activation, command/view registration, wiring |
| `src/connections/manager.ts` | Connection lifecycle, SecretStorage, reconnect |
| `src/connections/auth.ts` | Builds NATS `ConnectionOptions` from auth config |
| `src/connections/context-import.ts` | Parses `~/.config/nats/context/*.json` |
| `src/services/` | Service wrappers: `jetstream.ts`, `kv.ts`, `nats.ts`, `obj.ts`, `monitoring.ts`, `bookmarks.ts` |
| `src/types/` | `connection.ts` (config/auth), `nats.ts` (view types), `messages.ts` (postMessage protocol), `monitoring.ts` (HTTP API types) |
| `src/utils/` | `codec.ts` (payload decode), `format.ts` (bytes/count/duration), `subject.ts` (wildcard matching) |
| `src/views/trees/` | Tree providers: `connections.ts`, `streams.ts`, `kv.ts`, `obj.ts`, `subjects.ts` |
| `src/views/webviews/` | `webview-panel-manager.ts` (CSP, URI rewriting), `message-router.ts` (postMessage dispatch) |
| `src/views/input/` | Multi-step wizards: `connection-wizard.ts`, `stream-wizard.ts`, `consumer-wizard.ts` |
| `src/cli/nats-cli.ts` | NATS CLI detection and command palette integration |
| `src/config/workspace.ts` | `.leafnode.json` workspace config loader |
| `schemas/` | `leafnode-config.schema.json` for `.leafnode.json` IntelliSense |
| `webview-ui/src/panels/` | Svelte 5 components for each webview panel |
| `webview-ui/src/lib/` | `vscode-api.ts` (postMessage wrapper), `theme.css` (VS Code CSS vars), `VirtualList.svelte`, `Sparkline.svelte` |

## NATS Client (v3 modular)

```typescript
import { connect } from "@nats-io/transport-node";
import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import { Kvm } from "@nats-io/kv";
import { Objm } from "@nats-io/obj";
// NOT the old nc.jetstream() / nc.kv() pattern
```

## Conventions

- Extension host code is TypeScript with `"moduleResolution": "bundler"`. esbuild converts to CJS.
- Webview code uses Svelte 5 runes (`$state`, `$derived`, `$effect`), not legacy stores.
- Secrets (tokens, passwords, NKeys, creds) go in VS Code `SecretStorage`, never in settings or globalState. Auth config types store SecretStorage *keys*, not values.
- Tree items use codicons (`$(plug)`, `$(database)`, `$(archive)`, etc.) and `contextValue` for menu `when` clauses.
- Commands follow the pattern `leafnode.<area>.<action>` (e.g. `leafnode.streams.purge`).
- Webview-extension communication uses discriminated unions: `ExtensionMessage` (webview→ext) and `WebviewMessage` (ext→webview) in `src/types/messages.ts`.
- `.vscodeignore` keeps the VSIX small (~130KB). Only `dist/`, `resources/`, `schemas/`, `package.json`, `README.md` are included. `--no-dependencies` on vsce since esbuild bundles everything.
- Error messages in commands use the `showError(prefix, err)` helper in `extension.ts`.

## Testing

```bash
npm run test                   # 51 unit tests (vitest)
npm run test:integration       # integration tests (requires nats-server)
npm run test:e2e               # 83 E2E tests (requires nats-server + Xvfb on Linux)
```

E2E tests use `@vscode/test-electron` — they run inside the VS Code extension host with full API access. Tests cover connection lifecycle, stream/consumer/KV CRUD, pub/sub round-trips, monitoring endpoints, bookmarks, and webview panel loading. CI runs them with `xvfb-run` and reports results via `dorny/test-reporter`.

## CI/CD

- `.github/workflows/ci.yml` — Build + test on push/PR. Starts `nats:latest` Docker with JetStream (`-js -m 8222`). Runs unit + E2E tests. Posts test report to PR. Creates pre-release on main pushes. Uploads VSIX artifact.
- `.github/workflows/release.yml` — On GitHub Release publish: builds, sets version from tag, publishes to VS Code Marketplace + Open VSX, attaches VSIX to release.
- `.github/workflows/docs.yml` — Deploys VitePress docs to GitHub Pages on changes to `docs/`.
- Required secrets: `VSCE_PAT`, `OVSX_PAT`.

## Documentation

VitePress site at `docs/`. Run `npm run docs:dev` for local preview. Supports Mermaid diagrams via `vitepress-plugin-mermaid`.

## Roadmap

Tracked as GitHub issues. Most phases are implemented:
- **Implemented**: #1-#8, #10-#14, #16-#17, #20, #23, #25 (19 of 25 issues)
- **Open**: #9 (icon), #15 (schema support), #18 (cluster topology), #19 (services discovery), #21 (NATS config language), #22 (CodeLens), #24 (testing support)
