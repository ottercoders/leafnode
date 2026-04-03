# Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) under the **Leafnode** category.

## Connections

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.addConnection` | Add Connection | Add a new NATS server connection |
| `leafnode.editConnection` | Edit Connection | Modify an existing connection's settings |
| `leafnode.connect` | Connect | Connect to a NATS server |
| `leafnode.disconnect` | Disconnect | Disconnect from a NATS server |
| `leafnode.removeConnection` | Remove Connection | Remove a saved connection |
| `leafnode.importNatsContext` | Import NATS CLI Contexts | Import connection configs from NATS CLI context files |

## Streams

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.streams.refresh` | Refresh Streams | Reload the streams tree view |
| `leafnode.streams.browseMessages` | Browse Messages | Open the message browser for a stream |
| `leafnode.streams.create` | Create Stream | Create a new JetStream stream |
| `leafnode.streams.edit` | Edit Stream | Modify stream configuration |
| `leafnode.streams.duplicate` | Duplicate Stream | Clone a stream's settings to a new stream |
| `leafnode.streams.purge` | Purge Stream | Remove all messages from a stream |
| `leafnode.streams.seal` | Seal Stream | Make a stream read-only |
| `leafnode.streams.delete` | Delete Stream | Permanently delete a stream |

## Consumers

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.consumers.create` | Create Consumer | Create a new consumer on a stream |
| `leafnode.consumers.delete` | Delete Consumer | Remove a consumer |
| `leafnode.consumers.pause` | Pause Consumer | Temporarily stop message delivery |
| `leafnode.consumers.resume` | Resume Consumer | Resume a paused consumer |

## KV Stores

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.kv.refresh` | Refresh KV Stores | Reload the KV stores tree view |
| `leafnode.kv.viewEntry` | View Entry | Open a KV entry in the editor |
| `leafnode.kv.createBucket` | Create Bucket | Create a new KV bucket |
| `leafnode.kv.deleteBucket` | Delete Bucket | Remove a KV bucket and all its keys |
| `leafnode.kv.createKey` | Create Key | Add a new key to a bucket |
| `leafnode.kv.deleteKey` | Delete Key | Delete a key from a bucket |
| `leafnode.kv.purgeKey` | Purge Key | Remove all revisions of a key |
| `leafnode.kv.keyHistory` | View Key History | Show all revisions of a key |
| `leafnode.kv.loadMore` | Load More Keys | Load additional keys in a bucket |

## Object Stores

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.obj.refresh` | Refresh Object Stores | Reload the object stores tree view |
| `leafnode.obj.viewObject` | View Object | View object metadata |
| `leafnode.obj.deleteObject` | Delete Object | Remove an object from a store |

## Subjects

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.subjects.refresh` | Refresh Subjects | Reload the subjects tree view |

## Pub/Sub

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.openPubSub` | Open Pub/Sub Panel | Open the publish/subscribe panel |

## Monitoring

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.openServerMonitor` | Open Server Monitor | Open the server monitoring dashboard |

## CLI

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.runNatsCommand` | Run NATS CLI Command | Execute a NATS CLI command |

## Workspace

| Command | Title | Description |
|---------|-------|-------------|
| `leafnode.workspace.init` | Initialize Workspace Config | Generate a `.leafnode.json` template in the workspace root |
