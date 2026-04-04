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

## Message Rate

Streams display a real-time message rate in their tree item description when messages are flowing. The rate is calculated between tree refreshes and shown as msgs/s (e.g., `1,234 msgs, 5.2 MB (42/s)`). This gives quick visibility into which streams are actively receiving data.

## Mirror and Source Streams

Streams configured as mirrors or with source streams show their relationships as child nodes in the tree. Mirror nodes display the source stream name, and source nodes list each contributing stream. This makes it easy to visualize stream replication topology at a glance.

## Compare Stream Config

Right-click a stream and select **Compare Stream Config** to diff its configuration:

- Compare against another stream on the same server
- Compare against clipboard contents

The diff opens in VS Code's built-in diff editor, making it easy to spot configuration differences between streams.

## Message Search

The Message Browser includes a search input that searches message payloads by text pattern. Type a search term and press Enter to find messages containing that text. Results replace the current message list, making it easy to locate specific messages in large streams.

## Message Republish

When inspecting a message in the Message Browser, click **Republish** to send it to a different subject. The original subject is pre-filled and can be edited before sending. This is useful for replaying messages, moving them to dead-letter streams, or testing downstream consumers.

## Consumer Management

Right-click a consumer under a stream:

- **Create Consumer** — specify filter, ack policy, and deliver policy
- **Delete** — remove the consumer
- **Pause/Resume** — temporarily stop message delivery to the consumer. While paused, messages accumulate in the stream and are delivered once resumed. Useful for maintenance windows or debugging
- **Pull Messages** — pull N messages from the consumer for debugging. Enter the number of messages to fetch, and they are displayed in an output view

## Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+Alt+M` (`Cmd+Shift+Alt+M` on macOS) | Open Pub/Sub Panel |
| `Ctrl+Shift+Alt+J` (`Cmd+Shift+Alt+J` on macOS) | Open Server Monitor |
