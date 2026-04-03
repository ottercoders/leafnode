# Streams

The Streams view shows all JetStream streams across your connected servers.

## Stream Explorer

Each stream displays:
- Message count and total byte size
- Consumers with pending message lag
- Subject bindings

Expand a stream to see its consumers and subject configuration.

## Browsing Messages

Click the **Browse Messages** icon on a stream to open the Message Browser:

- Navigate by sequence number or time range
- Filter by subject pattern
- Click a message to inspect headers and payload
- JSON payloads are automatically pretty-printed
- Bookmark messages for quick access later

Messages are displayed in a virtual-scrolled list for smooth performance even with thousands of messages.

Toggle **Time range** in the toolbar to browse by date/time instead of sequence number.

## Stream Management

Right-click a stream for management options:

- **Create Stream** — define subjects, storage, retention, and replicas
- **Edit** — modify stream configuration
- **Duplicate** — clone settings to a new stream
- **Purge** — remove all messages
- **Seal** — make the stream read-only
- **Delete** — permanently remove the stream

## Consumer Management

Right-click a consumer under a stream:

- **Create Consumer** — specify filter, ack policy, and deliver policy
- **Delete** — remove the consumer
- **Pause/Resume** — temporarily stop message delivery to the consumer. While paused, messages accumulate in the stream and are delivered once resumed. Useful for maintenance windows or debugging
