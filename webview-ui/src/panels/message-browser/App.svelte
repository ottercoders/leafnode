<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import VirtualList from "../../lib/VirtualList.svelte";

  interface NatsMessage {
    subject: string;
    sequence?: number;
    timestamp: string;
    headers?: Record<string, string[]>;
    payload: string;
    payloadEncoding: "utf8" | "base64";
    size: number;
  }

  let connectionId = $state("");
  let streamName = $state("");
  let messages = $state<NatsMessage[]>([]);
  let selectedMessage = $state<NatsMessage | null>(null);
  let startSeq = $state(1);
  let subjectFilter = $state("");
  let loading = $state(false);
  let jumpToSeq = $state("");

  // Time range mode
  let browseMode = $state<"sequence" | "time">("sequence");
  let startTime = $state("");
  let endTime = $state("");

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
        streamName = msg.streamName;
        fetchMessages();
      } else if (msg.type === "stream:messages:data") {
        messages = msg.messages;
        loading = false;
      } else if (msg.type === "error") {
        loading = false;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  function fetchMessages() {
    loading = true;
    const opts: Record<string, unknown> = {
      subject: subjectFilter || undefined,
      limit: 50,
    };
    if (browseMode === "time" && startTime) {
      opts.startTime = new Date(startTime).toISOString();
      if (endTime) opts.endTime = new Date(endTime).toISOString();
    } else {
      opts.startSeq = startSeq;
    }
    vscode.postMessage({ type: "stream:messages", connectionId, stream: streamName, opts });
  }

  function goFirst() { startSeq = 1; browseMode = "sequence"; fetchMessages(); }
  function goPrev() { startSeq = Math.max(1, startSeq - 50); fetchMessages(); }
  function goNext() {
    if (messages.length > 0) {
      const lastSeq = messages[messages.length - 1].sequence ?? startSeq;
      startSeq = lastSeq + 1;
      browseMode = "sequence";
      fetchMessages();
    }
  }
  function goJump() {
    const seq = parseInt(jumpToSeq);
    if (!isNaN(seq) && seq > 0) { startSeq = seq; browseMode = "sequence"; fetchMessages(); }
  }
  function fetchByTime() { browseMode = "time"; fetchMessages(); }

  function selectMessage(msg: NatsMessage) {
    selectedMessage = selectedMessage === msg ? null : msg;
  }

  function formatPayload(msg: NatsMessage): string {
    if (msg.payloadEncoding === "base64") return `[base64] ${msg.payload}`;
    try { return JSON.stringify(JSON.parse(msg.payload), null, 2); }
    catch { return msg.payload; }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function copyToClipboard(text: string) { navigator.clipboard.writeText(text); }

  // Bookmark state
  let bookmarking = $state(false);
  let bookmarkName = $state("");

  function startBookmark() {
    bookmarking = true;
    bookmarkName = "";
  }

  function confirmBookmark() {
    if (!bookmarkName.trim() || !selectedMessage) return;
    vscode.postMessage({
      type: "bookmarks:saveMessage",
      bookmark: {
        name: bookmarkName.trim(),
        stream: streamName,
        sequence: selectedMessage.sequence ?? 0,
        subject: selectedMessage.subject,
      },
    });
    bookmarking = false;
    bookmarkName = "";
  }

  function cancelBookmark() {
    bookmarking = false;
    bookmarkName = "";
  }
</script>

<main>
  <div class="toolbar">
    <span class="stream-name">{streamName || "No stream selected"}</span>
    <div class="controls">
      <input type="text" bind:value={subjectFilter} placeholder="Filter by subject..."
        class="filter-input" onkeydown={(e) => e.key === "Enter" && fetchMessages()} />
      <button onclick={goFirst} title="First">|&laquo;</button>
      <button onclick={goPrev} title="Previous">&laquo;</button>
      <button onclick={goNext} title="Next">&raquo;</button>
      <input type="text" bind:value={jumpToSeq} placeholder="Seq #" class="jump-input"
        onkeydown={(e) => e.key === "Enter" && goJump()} />
      <button onclick={goJump}>Go</button>
      <button onclick={fetchMessages} title="Refresh">&#x21bb;</button>
    </div>
  </div>

  <div class="time-bar">
    <label class="mode-toggle">
      <input type="checkbox" checked={browseMode === "time"}
        onchange={() => browseMode = browseMode === "time" ? "sequence" : "time"} />
      Time range
    </label>
    {#if browseMode === "time"}
      <input type="datetime-local" bind:value={startTime} />
      <span>to</span>
      <input type="datetime-local" bind:value={endTime} />
      <button class="secondary" onclick={fetchByTime}>Fetch</button>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Loading messages...</div>
  {:else if messages.length === 0}
    <div class="empty">No messages found.</div>
  {:else}
    <div class="message-list-header">
      <table>
        <thead>
          <tr>
            <th class="col-seq">Seq</th>
            <th class="col-subject">Subject</th>
            <th class="col-ts">Timestamp</th>
            <th class="col-size">Size</th>
          </tr>
        </thead>
      </table>
    </div>
    <VirtualList items={messages} itemHeight={32}>
      {#snippet children({ item })}
        {@const msg = item as NatsMessage}
        <div class="msg-row" class:selected={selectedMessage === msg} onclick={() => selectMessage(msg)}>
          <span class="col-seq mono">{msg.sequence ?? "-"}</span>
          <span class="col-subject">{msg.subject}</span>
          <span class="col-ts mono">{msg.timestamp}</span>
          <span class="col-size mono">{formatSize(msg.size)}</span>
        </div>
      {/snippet}
    </VirtualList>
  {/if}

  {#if selectedMessage}
    <div class="detail-pane">
      <div class="detail-header">
        <span>Seq {selectedMessage.sequence} &mdash; {selectedMessage.subject}</span>
        <div class="detail-actions">
          <button onclick={() => copyToClipboard(selectedMessage!.payload)}>Copy Payload</button>
          {#if bookmarking}
            <input
              type="text"
              bind:value={bookmarkName}
              placeholder="Bookmark name..."
              class="bookmark-input"
              onkeydown={(e) => {
                if (e.key === "Enter") confirmBookmark();
                if (e.key === "Escape") cancelBookmark();
              }}
            />
            <button onclick={confirmBookmark}>Save</button>
            <button class="secondary" onclick={cancelBookmark}>Cancel</button>
          {:else}
            <button onclick={startBookmark}>Bookmark</button>
          {/if}
        </div>
      </div>
      {#if selectedMessage.headers && Object.keys(selectedMessage.headers).length > 0}
        <div class="section">
          <h4>Headers</h4>
          <table class="headers-table">
            <tbody>
              {#each Object.entries(selectedMessage.headers) as [key, values]}
                <tr><td class="header-key">{key}</td><td>{values.join(", ")}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <div class="section">
        <h4>Payload</h4>
        <pre>{formatPayload(selectedMessage)}</pre>
      </div>
    </div>
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; gap: 8px; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); flex-shrink: 0; }
  .stream-name { font-weight: 600; white-space: nowrap; }
  .controls { display: flex; gap: 4px; align-items: center; }
  .filter-input { width: 180px; }
  .jump-input { width: 70px; }
  .time-bar { display: flex; gap: 8px; align-items: center; padding: 4px 8px; flex-shrink: 0; font-size: 0.9em; }
  .mode-toggle { display: flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap; }
  .time-bar input[type="datetime-local"] { font-size: 0.9em; }
  .loading, .empty { padding: 24px; text-align: center; color: var(--vscode-descriptionForeground); }
  .message-list-header { flex-shrink: 0; }
  .message-list-header table { margin-bottom: 0; }
  .msg-row { display: flex; align-items: center; padding: 0 8px; cursor: pointer; height: 100%; }
  .msg-row:hover { background: var(--vscode-list-hoverBackground); }
  .selected { background: var(--vscode-list-activeSelectionBackground) !important; color: var(--vscode-list-activeSelectionForeground); }
  .col-seq { width: 80px; flex-shrink: 0; }
  .col-subject { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .col-ts { width: 200px; flex-shrink: 0; }
  .col-size { width: 80px; flex-shrink: 0; text-align: right; }
  th.col-seq { width: 80px; }
  th.col-subject { }
  th.col-ts { width: 200px; }
  th.col-size { width: 80px; text-align: right; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  .detail-pane { border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); max-height: 40vh; overflow: auto; padding: 8px; flex-shrink: 0; }
  .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; flex-wrap: wrap; gap: 4px; }
  .detail-actions { display: flex; gap: 4px; align-items: center; }
  .bookmark-input { width: 140px; font-size: 0.9em; }
  .section { margin-bottom: 12px; }
  .section h4 { margin: 4px 0; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  .headers-table { width: auto; }
  .header-key { font-weight: 600; white-space: nowrap; }
</style>
