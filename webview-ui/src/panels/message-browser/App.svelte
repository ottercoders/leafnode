<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import VirtualList from "../../lib/VirtualList.svelte";
  import JsonViewer from "../../lib/JsonViewer.svelte";
  import CopyButton from "../../lib/CopyButton.svelte";
  import KeyValue from "../../lib/KeyValue.svelte";
  import EmptyState from "../../lib/EmptyState.svelte";

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
  let detailOpen = $state(true);
  let detailTab = $state<"payload" | "headers" | "info">("payload");

  // Time range mode
  let browseMode = $state<"sequence" | "time">("sequence");
  let startTime = $state("");
  let endTime = $state("");

  // Bookmark state
  let bookmarking = $state(false);
  let bookmarkName = $state("");

  // Derived
  let messageCount = $derived(messages.length);
  let parsedPayload = $derived.by(() => {
    if (!selectedMessage) return null;
    if (selectedMessage.payloadEncoding === "base64") return null;
    try { return JSON.parse(selectedMessage.payload); } catch { return null; }
  });

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
  function goLast() {
    // Go to last page - set high seq to get latest
    startSeq = Number.MAX_SAFE_INTEGER;
    browseMode = "sequence";
    fetchMessages();
  }
  function goJump() {
    const seq = parseInt(jumpToSeq);
    if (!isNaN(seq) && seq > 0) { startSeq = seq; browseMode = "sequence"; fetchMessages(); }
  }
  function fetchByTime() { browseMode = "time"; fetchMessages(); }

  function selectMessage(msg: NatsMessage) {
    selectedMessage = selectedMessage === msg ? null : msg;
    if (selectedMessage) detailOpen = true;
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

  function formatTimestamp(ts: string): string {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
    } catch { return ts; }
  }

  function formatFullTimestamp(ts: string): string {
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  }

  function copyToClipboard(text: string) { navigator.clipboard.writeText(text); }

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

  let hasHeaders = $derived(
    selectedMessage?.headers != null && Object.keys(selectedMessage.headers).length > 0
  );
</script>

<main>
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="stream-title">{streamName || "No stream selected"}</span>
      {#if messageCount > 0}
        <span class="badge info">{messageCount.toLocaleString()} msgs</span>
      {/if}
    </div>
    <div class="toolbar-right">
      <input type="text" bind:value={subjectFilter} placeholder="Filter by subject..."
        class="filter-input" onkeydown={(e) => e.key === "Enter" && fetchMessages()} />
      <div class="nav-group">
        <button class="secondary small" onclick={goFirst} title="First page">|&laquo;</button>
        <button class="secondary small" onclick={goPrev} title="Previous page">&laquo;</button>
        <button class="secondary small" onclick={goNext} title="Next page">&raquo;</button>
        <button class="secondary small" onclick={goLast} title="Last page">&raquo;|</button>
      </div>
      <div class="jump-group">
        <input type="text" bind:value={jumpToSeq} placeholder="Seq #" class="jump-input"
          onkeydown={(e) => e.key === "Enter" && goJump()} />
        <button class="secondary small" onclick={goJump}>Go</button>
      </div>
      <button class="icon-btn" onclick={fetchMessages} title="Refresh">&#x21bb;</button>
    </div>
  </div>

  <!-- Time range bar -->
  <div class="time-bar">
    <label class="time-toggle">
      <input type="checkbox" checked={browseMode === "time"}
        onchange={() => browseMode = browseMode === "time" ? "sequence" : "time"} />
      <span>Time range</span>
    </label>
    {#if browseMode === "time"}
      <input type="datetime-local" bind:value={startTime} class="time-input" />
      <span class="time-sep">to</span>
      <input type="datetime-local" bind:value={endTime} class="time-input" />
      <button class="secondary small" onclick={fetchByTime}>Fetch</button>
    {/if}
  </div>

  <!-- Message list -->
  {#if loading}
    <EmptyState state="loading" message="Loading messages..." />
  {:else if messages.length === 0}
    <EmptyState state="empty" message="No messages found." />
  {:else}
    <div class="list-header">
      <span class="hdr-seq">Seq</span>
      <span class="hdr-subject">Subject</span>
      <span class="hdr-ts">Time</span>
      <span class="hdr-size">Size</span>
    </div>
    <VirtualList items={messages} itemHeight={32} totalLabel="messages">
      {#snippet children({ item })}
        {@const msg = item as NatsMessage}
        <div class="msg-row" class:selected={selectedMessage === msg} onclick={() => selectMessage(msg)}>
          <span class="col-seq mono">{msg.sequence ?? "-"}</span>
          <span class="col-subject">{msg.subject}</span>
          <span class="col-ts mono" title={msg.timestamp}>{formatTimestamp(msg.timestamp)}</span>
          <span class="col-size mono">{formatSize(msg.size)}</span>
        </div>
      {/snippet}
    </VirtualList>
  {/if}

  <!-- Detail pane -->
  {#if selectedMessage && detailOpen}
    <div class="detail-pane">
      <div class="detail-toolbar">
        <div class="detail-tabs">
          <button class="detail-tab" class:active={detailTab === "payload"} onclick={() => detailTab = "payload"}>Payload</button>
          <button class="detail-tab" class:active={detailTab === "headers"} onclick={() => detailTab = "headers"}>Headers{#if hasHeaders} ({Object.keys(selectedMessage.headers!).length}){/if}</button>
          <button class="detail-tab" class:active={detailTab === "info"} onclick={() => detailTab = "info"}>Info</button>
        </div>
        <div class="detail-actions">
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
            <button class="small" onclick={confirmBookmark}>Save</button>
            <button class="secondary small" onclick={cancelBookmark}>Cancel</button>
          {:else}
            <button class="icon-btn" onclick={startBookmark} title="Bookmark this message">&#x2605;</button>
          {/if}
          <button class="icon-btn" onclick={() => detailOpen = false} title="Close detail">&times;</button>
        </div>
      </div>

      <div class="detail-content">
        {#if detailTab === "payload"}
          <div class="payload-header">
            <CopyButton text={selectedMessage.payload} label="Copy payload" />
          </div>
          {#if selectedMessage.payloadEncoding === "base64"}
            <pre class="payload-pre">[base64] {selectedMessage.payload}</pre>
          {:else if parsedPayload !== null}
            <div class="json-viewer-wrap">
              <JsonViewer data={parsedPayload} />
            </div>
          {:else}
            <pre class="payload-pre">{selectedMessage.payload}</pre>
          {/if}

        {:else if detailTab === "headers"}
          {#if hasHeaders}
            <div class="headers-list">
              {#each Object.entries(selectedMessage.headers!) as [key, values]}
                <KeyValue label={key} value={values.join(", ")} mono copyable />
              {/each}
            </div>
          {:else}
            <EmptyState state="empty" message="No headers on this message." />
          {/if}

        {:else if detailTab === "info"}
          <div class="info-list">
            <KeyValue label="Subject" value={selectedMessage.subject} mono copyable />
            <KeyValue label="Sequence" value={String(selectedMessage.sequence ?? "-")} mono />
            <KeyValue label="Timestamp" value={formatFullTimestamp(selectedMessage.timestamp)} mono copyable />
            <KeyValue label="Size" value={formatSize(selectedMessage.size)} mono />
            <KeyValue label="Encoding" value={selectedMessage.payloadEncoding} mono />
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  /* Toolbar */
  .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; gap: 8px; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); flex-shrink: 0; flex-wrap: wrap; }
  .toolbar-left { display: flex; align-items: center; gap: 8px; }
  .stream-title { font-weight: 700; font-size: 1.05em; white-space: nowrap; }
  .toolbar-right { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .filter-input { width: 180px; }
  .nav-group { display: flex; gap: 2px; }
  .nav-group button { min-width: 28px; padding: 2px 6px; }
  .jump-group { display: flex; gap: 2px; }
  .jump-input { width: 70px; }

  /* Time bar */
  .time-bar { display: flex; gap: 8px; align-items: center; padding: 4px 8px; flex-shrink: 0; font-size: 0.9em; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); }
  .time-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; user-select: none; }
  .time-input { font-size: 0.9em; }
  .time-sep { color: var(--vscode-descriptionForeground); }

  /* List header */
  .list-header { display: flex; align-items: center; padding: 4px 8px; font-size: 0.8em; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); flex-shrink: 0; }
  .hdr-seq { width: 72px; flex-shrink: 0; }
  .hdr-subject { flex: 1; }
  .hdr-ts { width: 120px; flex-shrink: 0; }
  .hdr-size { width: 72px; flex-shrink: 0; text-align: right; }

  /* Message rows */
  .msg-row { display: flex; align-items: center; padding: 0 8px; cursor: pointer; height: 100%; border-left: 3px solid transparent; transition: border-color 0.1s, background-color 0.1s; }
  .msg-row:hover { background: var(--vscode-list-hoverBackground); }
  .selected { background: var(--vscode-list-activeSelectionBackground) !important; color: var(--vscode-list-activeSelectionForeground); border-left-color: var(--vscode-focusBorder) !important; }
  .col-seq { width: 72px; flex-shrink: 0; font-size: 0.9em; }
  .col-subject { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .col-ts { width: 120px; flex-shrink: 0; font-size: 0.85em; }
  .col-size { width: 72px; flex-shrink: 0; text-align: right; font-size: 0.85em; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }

  /* Detail pane */
  .detail-pane { border-top: 2px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); max-height: 45vh; display: flex; flex-direction: column; flex-shrink: 0; }
  .detail-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0 8px; flex-shrink: 0; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); }
  .detail-tabs { display: flex; gap: 0; }
  .detail-tab { background: none; border: none; border-bottom: 2px solid transparent; border-radius: 0; padding: 6px 12px; min-height: auto; color: var(--vscode-foreground); opacity: 0.6; cursor: pointer; font-size: 0.9em; transition: opacity 0.15s, border-color 0.15s; }
  .detail-tab:hover { opacity: 1; background: none; }
  .detail-tab.active { border-bottom-color: var(--vscode-focusBorder); color: var(--vscode-focusBorder); opacity: 1; }
  .detail-actions { display: flex; gap: 4px; align-items: center; }
  .bookmark-input { width: 140px; font-size: 0.9em; }

  .detail-content { overflow: auto; padding: 8px 12px; flex: 1; min-height: 0; }

  /* Payload */
  .payload-header { display: flex; justify-content: flex-end; margin-bottom: 4px; }
  .payload-pre { margin: 0; }
  .json-viewer-wrap { padding: 4px 0; }

  /* Headers / Info */
  .headers-list, .info-list { padding: 4px 0; }
</style>
