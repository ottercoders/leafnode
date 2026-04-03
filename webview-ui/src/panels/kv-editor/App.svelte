<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import JsonViewer from "../../lib/JsonViewer.svelte";
  import CopyButton from "../../lib/CopyButton.svelte";
  import StatusBadge from "../../lib/StatusBadge.svelte";
  import EmptyState from "../../lib/EmptyState.svelte";
  import KeyValue from "../../lib/KeyValue.svelte";
  import VirtualList from "../../lib/VirtualList.svelte";

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
  let keys = $state<string[]>([]);
  let selectedKey = $state<string | null>(null);
  let entry = $state<KvEntry | null>(null);
  let editMode = $state(false);
  let editValue = $state("");
  let historyEntries = $state<KvEntry[]>([]);
  let showHistory = $state(false);
  let watching = $state(false);
  let watchId = $state("");
  let keyFilter = $state("");
  let loading = $state(true);
  let loadingEntry = $state(false);
  let creatingKey = $state(false);
  let newKeyName = $state("");

  let filteredKeys = $derived(
    keyFilter
      ? keys.filter((k) => k.toLowerCase().includes(keyFilter.toLowerCase()))
      : keys
  );

  let parsedJson = $derived.by(() => {
    if (!entry || entry.valueEncoding === "base64") return null;
    try {
      return JSON.parse(entry.value);
    } catch {
      return null;
    }
  });

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
        bucket = msg.bucket;
        if (msg.key) {
          selectedKey = msg.key;
        }
        fetchKeys();
        if (msg.showHistory) showHistory = true;
      } else if (msg.type === "kv:keys:data") {
        keys = msg.keys;
        loading = false;
        if (selectedKey) {
          fetchEntry(selectedKey);
        }
      } else if (msg.type === "kv:entry") {
        entry = msg.entry;
        editValue = msg.entry.value;
        loadingEntry = false;
      } else if (msg.type === "kv:history:data") {
        historyEntries = msg.entries;
      } else if (msg.type === "kv:watch:update") {
        if (msg.id === watchId) {
          entry = msg.entry;
          editValue = msg.entry.value;
        }
      } else if (msg.type === "error") {
        loading = false;
        loadingEntry = false;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  function fetchKeys() {
    loading = true;
    vscode.postMessage({ type: "kv:keys", connectionId, bucket });
  }

  function fetchEntry(key: string) {
    loadingEntry = true;
    showHistory = false;
    historyEntries = [];
    vscode.postMessage({ type: "kv:get", connectionId, bucket, key });
  }

  function selectKey(key: string) {
    if (watching) stopWatch();
    editMode = false;
    selectedKey = key;
    fetchEntry(key);
  }

  function fetchHistory() {
    showHistory = !showHistory;
    if (showHistory && selectedKey) {
      vscode.postMessage({
        type: "kv:history",
        connectionId,
        bucket,
        key: selectedKey,
      });
    }
  }

  function toggleWatch() {
    if (watching) {
      stopWatch();
    } else if (selectedKey) {
      const id = `watch-${Date.now()}`;
      watchId = id;
      vscode.postMessage({
        type: "kv:watch",
        connectionId,
        bucket,
        key: selectedKey,
        id,
      });
      watching = true;
    }
  }

  function stopWatch() {
    vscode.postMessage({ type: "kv:unwatch", id: watchId });
    watching = false;
    watchId = "";
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
    if (!selectedKey) return;
    vscode.postMessage({
      type: "kv:put",
      connectionId,
      bucket,
      key: selectedKey,
      value: editValue,
    });
    editMode = false;
  }

  function startCreateKey() {
    creatingKey = true;
    newKeyName = "";
  }

  function cancelCreateKey() {
    creatingKey = false;
    newKeyName = "";
  }

  function submitCreateKey() {
    if (!newKeyName.trim()) return;
    vscode.postMessage({
      type: "kv:put",
      connectionId,
      bucket,
      key: newKeyName.trim(),
      value: "",
    });
    selectedKey = newKeyName.trim();
    creatingKey = false;
    newKeyName = "";
    // Refresh keys list after a short delay
    setTimeout(fetchKeys, 300);
  }

  function formatTimestamp(ts: string): string {
    if (!ts) return "-";
    return ts.replace("T", " ").replace("Z", " UTC");
  }

  function operationBadgeStatus(
    op: string
  ): "success" | "warning" | "error" | "info" {
    if (op === "PUT") return "success";
    if (op === "DEL" || op === "PURGE") return "error";
    return "info";
  }
</script>

<main>
  {#if loading}
    <EmptyState state="loading" message="Loading keys..." />
  {:else}
    <div class="split-pane">
      <!-- Left pane: key list -->
      <div class="split-left">
        <div class="list-header">
          <div class="list-title">
            <span class="bucket-name">{bucket}</span>
            <span class="badge info">{filteredKeys.length}</span>
          </div>
          <button class="small" onclick={startCreateKey}>+ New Key</button>
        </div>

        {#if creatingKey}
          <div class="create-key-row">
            <input
              type="text"
              bind:value={newKeyName}
              placeholder="Key name..."
              onkeydown={(e) => {
                if (e.key === "Enter") submitCreateKey();
                if (e.key === "Escape") cancelCreateKey();
              }}
            />
            <button class="small" onclick={submitCreateKey}>Add</button>
            <button class="small secondary" onclick={cancelCreateKey}
              >Cancel</button
            >
          </div>
        {/if}

        <div class="search-row">
          <input
            type="text"
            bind:value={keyFilter}
            placeholder="Filter keys..."
            class="search-input"
          />
        </div>

        <VirtualList items={filteredKeys} itemHeight={32} totalLabel="keys">
          {#snippet children({ item, index })}
            {@const k = item as string}
            <button
              class="key-row"
              class:selected={k === selectedKey}
              onclick={() => selectKey(k)}
            >
              <span class="key-name mono">{k}</span>
            </button>
          {/snippet}
        </VirtualList>
      </div>

      <!-- Right pane: value viewer/editor -->
      <div class="split-right">
        {#if !selectedKey}
          <EmptyState state="empty" message="Select a key to view its value" />
        {:else if loadingEntry}
          <EmptyState state="loading" message="Loading entry..." />
        {:else if !entry}
          <EmptyState state="error" message="Key not found" />
        {:else}
          <!-- Entry header -->
          <div class="entry-header">
            <div class="entry-title-row">
              <span class="entry-key mono">{entry.key}</span>
              <CopyButton text={entry.key} label="Copy key name" />
              {#if watching}
                <StatusBadge status="success" label="LIVE" />
              {/if}
            </div>
            <div class="entry-meta">
              <span class="badge info">r{entry.revision}</span>
              <StatusBadge
                status={operationBadgeStatus(entry.operation)}
                label={entry.operation}
              />
              <span class="timestamp">{formatTimestamp(entry.created)}</span>
            </div>
          </div>

          <!-- Actions toolbar -->
          <div class="toolbar">
            {#if editMode}
              <button onclick={saveEdit}>Save</button>
              <button class="secondary" onclick={cancelEdit}>Cancel</button>
            {:else}
              <button onclick={startEdit}>Edit</button>
            {/if}
            <button class="secondary" onclick={toggleWatch}>
              {watching ? "Stop Watch" : "Watch"}
            </button>
            <button class="secondary" onclick={fetchHistory}>
              {showHistory ? "Hide History" : "History"}
            </button>
            <div class="spacer"></div>
            <button
              class="secondary"
              onclick={() => selectedKey && fetchEntry(selectedKey)}>Refresh</button
            >
          </div>

          <!-- Value display -->
          <div class="value-pane">
            {#if editMode}
              <textarea
                bind:value={editValue}
                class="value-editor"
                spellcheck="false"
              ></textarea>
            {:else}
              <div class="value-content">
                {#if entry.valueEncoding === "base64"}
                  <div class="base64-notice">
                    <StatusBadge status="info" label="base64" />
                    <pre class="mono">{entry.value}</pre>
                  </div>
                {:else if parsedJson !== null}
                  <div class="json-viewer-wrap">
                    <div class="value-actions">
                      <CopyButton text={entry.value} label="Copy value" />
                    </div>
                    <JsonViewer data={parsedJson} />
                  </div>
                {:else}
                  <div class="text-value-wrap">
                    <div class="value-actions">
                      <CopyButton text={entry.value} label="Copy value" />
                    </div>
                    <pre>{entry.value}</pre>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- History section -->
          {#if showHistory}
            <div class="history-pane">
              <div class="history-header">
                <span class="history-title">History</span>
                <span class="badge info">{historyEntries.length}</span>
              </div>
              {#if historyEntries.length === 0}
                <div class="history-empty">Loading history...</div>
              {:else}
                <div class="history-list">
                  {#each historyEntries as he}
                    <div class="history-entry">
                      <div class="history-entry-header">
                        <span class="badge info">r{he.revision}</span>
                        <StatusBadge
                          status={operationBadgeStatus(he.operation)}
                          label={he.operation}
                        />
                        <span class="timestamp"
                          >{formatTimestamp(he.created)}</span
                        >
                      </div>
                      <div class="history-value mono">
                        {he.value.slice(0, 120)}{he.value.length > 120
                          ? "..."
                          : ""}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* Left pane */
  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2);
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    flex-shrink: 0;
  }

  .list-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 600;
  }

  .bucket-name {
    font-size: 0.95em;
  }

  .search-row {
    padding: var(--space-1) var(--space-2);
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    border-radius: var(--radius);
  }

  .create-key-row {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    flex-shrink: 0;
  }

  .create-key-row input {
    flex: 1;
    min-width: 0;
    border-radius: var(--radius);
  }

  .key-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0 var(--space-2);
    height: 32px;
    background: none;
    border: none;
    border-radius: 0;
    color: var(--vscode-foreground);
    cursor: pointer;
    text-align: left;
    min-height: 32px;
    gap: var(--space-2);
  }

  .key-row:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .key-row.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }

  .key-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    font-size: 0.9em;
  }

  /* Right pane */
  .entry-header {
    padding: var(--space-3);
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    flex-shrink: 0;
  }

  .entry-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .entry-key {
    font-weight: 600;
    font-size: 1.1em;
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .timestamp {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
  }

  .spacer {
    flex: 1;
  }

  .value-pane {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }

  .value-content {
    padding: var(--space-3);
  }

  .value-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--space-1);
  }

  .json-viewer-wrap,
  .text-value-wrap {
    position: relative;
  }

  .base64-notice {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .value-editor {
    width: 100%;
    height: 100%;
    min-height: 200px;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    resize: none;
    border: none;
    border-radius: 0;
    padding: var(--space-3);
  }

  /* History pane */
  .history-pane {
    border-top: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    max-height: 35vh;
    overflow: auto;
    flex-shrink: 0;
  }

  .history-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    position: sticky;
    top: 0;
    background: var(--vscode-editor-background);
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
  }

  .history-title {
    font-weight: 600;
    font-size: 0.9em;
  }

  .history-empty {
    padding: var(--space-3);
    color: var(--vscode-descriptionForeground);
    text-align: center;
    font-size: 0.9em;
  }

  .history-list {
    padding: var(--space-1) 0;
  }

  .history-entry {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
  }

  .history-entry:last-child {
    border-bottom: none;
  }

  .history-entry-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .history-value {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
