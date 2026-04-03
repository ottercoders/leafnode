# Workspace Configuration

Leafnode supports a `.leafnode.json` file in the workspace root for shareable, version-controllable configuration.

## Creating

Run **Leafnode: Initialize Workspace Configuration** from the command palette to generate a template.

## Format

```json
{
  "connections": [
    {
      "name": "local-dev",
      "servers": ["nats://localhost:4222"],
      "monitoringUrl": "http://localhost:8222"
    }
  ]
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `connections` | `array` | Connection configurations (without secrets) |
| `connections[].name` | `string` | Display name |
| `connections[].servers` | `string[]` | NATS server URLs |
| `connections[].monitoringUrl` | `string?` | HTTP monitoring endpoint |

## IntelliSense

The `.leafnode.json` file has JSON Schema validation enabled, providing auto-completion and validation in VS Code.

## Security

Never put credentials in `.leafnode.json`. Use VS Code's SecretStorage for secrets — set auth via the connection wizard.
