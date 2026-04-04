# KV Stores

Browse, edit, and watch NATS Key-Value store entries.

## Browsing

The KV Stores view lists all buckets with key counts and sizes. Expand a bucket to see its keys. Click a key to open the KV Editor.

## KV Editor

The editor panel shows:
- Bucket and key name
- Current revision number
- Operation type (PUT, DEL, PURGE)
- Timestamp

### Editing Values

Click **Edit** to switch to edit mode. Modify the value and click **Save** to publish a new revision.

### Watch Mode

Click **Watch** to enable real-time updates. A green "LIVE" badge indicates when watching is active. The editor auto-updates when the key changes.

When a watched key changes, Leafnode shows a VS Code toast notification with the key name, operation type (PUT, DEL, PURGE), and revision number. This ensures you are alerted to changes even when the KV Editor panel is not visible.

### Key History

Click **Show History** to see all revisions of a key with timestamps and operation types.

## Bucket Management

- **Create Bucket** — click the + icon in the KV Stores view title
- **Create Key** — right-click a bucket
- **Delete Key** / **Purge Key** — right-click a key
- **Delete Bucket** — right-click a bucket
