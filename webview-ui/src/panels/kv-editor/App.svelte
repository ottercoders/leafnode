<script lang="ts">
  import { vscode } from "../../lib/vscode-api";

  interface KvEntry {
    key: string;
    value: string;
    valueEncoding: "utf8" | "base64";
    revision: number;
    created: string;
    operation: string;
  }

  let connectionId = $state("");
  let bucket = $state("");
  let key = $state("");
  let entry = $state<KvEntry | null>(null);
  let editMode = $state(false);
  let editValue = $state("");
  let historyEntries = $state<KvEntry[]>([]);
  let showHistory = $state(false);
  let loading = $state(true);

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
        bucket = msg.bucket;
        key = msg.key;
        fetchEntry();
      } else if (msg.type === "kv:entry") {
        entry = msg.entry;
        editValue = msg.entry.value;
        loading = false;
      } else if (msg.type === "kv:history:data") {
        historyEntries = msg.entries;
      } else if (msg.type === "error") {
        loading = false;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  function fetchEntry() {
    loading = true;
    vscode.postMessage({
      type: "kv:get",
      connectionId,
      bucket,
      key,
    });
  }

  function fetchHistory() {
    showHistory = !showHistory;
    if (showHistory) {
      vscode.postMessage({
        type: "kv:history",
        connectionId,
        bucket,
        key,
      });
    }
  }

  function startEdit() {
    editMode = true;
    editValue = entry?.value ?? "";
  }

  function cancelEdit() {
    editMode = false;
    editValue = entry?.value ?? "";
  }

  function saveEdit() {
    vscode.postMessage({
      type: "kv:put",
      connectionId,
      bucket,
      key,
      value: editValue,
    });
    editMode = false;
  }

  function formatValue(val: string, encoding: string): string {
    if (encoding === "base64") return `[base64] ${val}`;
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  }

  function formatTimestamp(ts: string): string {
    return ts.replace("T", " ").replace("Z", "");
  }
</script>

<main>
  <div class="header">
    <div class="breadcrumb">
      <span class="bucket-name">{bucket}</span>
      <span class="sep">/</span>
      <span class="key-name">{key}</span>
    </div>
    {#if entry}
      <div class="meta">
        <span>Rev {entry.revision}</span>
        <span class="sep">|</span>
        <span>{entry.operation}</span>
        <span class="sep">|</span>
        <span>{formatTimestamp(entry.created)}</span>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if !entry}
    <div class="empty">Key not found.</div>
  {:else}
    <div class="toolbar">
      {#if editMode}
        <button onclick={saveEdit}>Save</button>
        <button class="secondary" onclick={cancelEdit}>Cancel</button>
      {:else}
        <button onclick={startEdit}>Edit</button>
      {/if}
      <button class="secondary" onclick={fetchHistory}>
        {showHistory ? "Hide History" : "Show History"}
      </button>
      <button class="secondary" onclick={fetchEntry}>Refresh</button>
    </div>

    <div class="value-pane">
      {#if editMode}
        <textarea bind:value={editValue} rows={20} class="value-editor"></textarea>
      {:else}
        <pre class="value-display">{formatValue(entry.value, entry.valueEncoding)}</pre>
      {/if}
    </div>

    {#if showHistory}
      <div class="history-pane">
        <h4>History</h4>
        <table>
          <thead>
            <tr>
              <th>Rev</th>
              <th>Operation</th>
              <th>Created</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {#each historyEntries as he}
              <tr>
                <td>{he.revision}</td>
                <td>{he.operation}</td>
                <td class="mono">{formatTimestamp(he.created)}</td>
                <td class="value-preview">{he.value.slice(0, 80)}{he.value.length > 80 ? "..." : ""}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .header {
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    flex-shrink: 0;
  }
  .breadcrumb {
    font-weight: 600;
    font-size: 1.1em;
  }
  .bucket-name {
    color: var(--vscode-descriptionForeground);
  }
  .sep {
    color: var(--vscode-descriptionForeground);
    margin: 0 4px;
  }
  .meta {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
  }
  .toolbar {
    display: flex;
    gap: 4px;
    padding: 8px;
    flex-shrink: 0;
  }
  .value-pane {
    flex: 1;
    overflow: auto;
    padding: 0 8px;
    min-height: 100px;
  }
  .value-display {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .value-editor {
    width: 100%;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    resize: vertical;
  }
  .history-pane {
    border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    max-height: 35vh;
    overflow: auto;
    padding: 8px;
    flex-shrink: 0;
  }
  .history-pane h4 {
    margin: 0 0 8px 0;
    color: var(--vscode-descriptionForeground);
  }
  .mono {
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
  }
  .value-preview {
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .loading, .empty {
    padding: 24px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
  }
</style>
