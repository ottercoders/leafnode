# Server Monitoring

The Server Monitor dashboard displays real-time metrics from the NATS HTTP monitoring API.

## Prerequisites

Your connection must have a **Monitoring URL** configured (e.g., `http://localhost:8222`). Set this when adding or editing a connection.

## Opening

Run **Leafnode: Open Server Monitor** from the command palette.

## Tabs

### Server

General server information: version, uptime, CPU/memory usage, connection counts, message throughput, and slow consumers. Key metrics include sparkline charts showing trends over time.

### Connections

Table of active client connections with name, IP, language, version, RTT, message rates, and subscription counts.

### JetStream

JetStream resource usage: stream/consumer counts, memory and storage used, API call statistics.

### Accounts

List of NATS accounts configured on the server.

## Auto-Refresh

The dashboard polls every 5 seconds automatically.
