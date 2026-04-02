<script lang="ts">
  import { vscode } from "../../lib/vscode-api";

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

  // Receive initial data and messages from extension
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
    vscode.postMessage({
      type: "stream:messages",
      connectionId,
      stream: streamName,
      opts: {
        startSeq,
        subject: subjectFilter || undefined,
        limit: 50,
      },
    });
  }

  function goFirst() {
    startSeq = 1;
    fetchMessages();
  }

  function goPrev() {
    startSeq = Math.max(1, startSeq - 50);
    fetchMessages();
  }

  function goNext() {
    if (messages.length > 0) {
      const lastSeq = messages[messages.length - 1].sequence ?? startSeq;
      startSeq = lastSeq + 1;
      fetchMessages();
    }
  }

  function goJump() {
    const seq = parseInt(jumpToSeq);
    if (!isNaN(seq) && seq > 0) {
      startSeq = seq;
      fetchMessages();
    }
  }

  function selectMessage(msg: NatsMessage) {
    selectedMessage = selectedMessage === msg ? null : msg;
  }

  function formatPayload(msg: NatsMessage): string {
    if (msg.payloadEncoding === "base64") return `[base64] ${msg.payload}`;
    try {
      return JSON.stringify(JSON.parse(msg.payload), null, 2);
    } catch {
      return msg.payload;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<main>
  <div class="toolbar">
    <span class="stream-name">{streamName || "No stream selected"}</span>
    <div class="controls">
      <input
        type="text"
        bind:value={subjectFilter}
        placeholder="Filter by subject..."
        class="filter-input"
        onkeydown={(e) => e.key === "Enter" && fetchMessages()}
      />
      <button onclick={goFirst} title="First">|&laquo;</button>
      <button onclick={goPrev} title="Previous">&laquo;</button>
      <button onclick={goNext} title="Next">&raquo;</button>
      <input
        type="text"
        bind:value={jumpToSeq}
        placeholder="Seq #"
        class="jump-input"
        onkeydown={(e) => e.key === "Enter" && goJump()}
      />
      <button onclick={goJump}>Go</button>
      <button onclick={fetchMessages} title="Refresh">&#x21bb;</button>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading messages...</div>
  {:else if messages.length === 0}
    <div class="empty">No messages found.</div>
  {:else}
    <div class="message-list">
      <table>
        <thead>
          <tr>
            <th>Seq</th>
            <th>Subject</th>
            <th>Timestamp</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {#each messages as msg}
            <tr
              class:selected={selectedMessage === msg}
              onclick={() => selectMessage(msg)}
            >
              <td class="mono">{msg.sequence ?? "-"}</td>
              <td>{msg.subject}</td>
              <td class="mono">{msg.timestamp}</td>
              <td class="mono">{formatSize(msg.size)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if selectedMessage}
    <div class="detail-pane">
      <div class="detail-header">
        <span>Seq {selectedMessage.sequence} &mdash; {selectedMessage.subject}</span>
        <button onclick={() => copyToClipboard(selectedMessage!.payload)}>Copy Payload</button>
      </div>

      {#if selectedMessage.headers && Object.keys(selectedMessage.headers).length > 0}
        <div class="section">
          <h4>Headers</h4>
          <table class="headers-table">
            <tbody>
              {#each Object.entries(selectedMessage.headers) as [key, values]}
                <tr>
                  <td class="header-key">{key}</td>
                  <td>{values.join(", ")}</td>
                </tr>
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
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    flex-shrink: 0;
  }
  .stream-name {
    font-weight: 600;
    white-space: nowrap;
  }
  .controls {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .filter-input {
    width: 180px;
  }
  .jump-input {
    width: 70px;
  }
  .loading, .empty {
    padding: 24px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
  }
  .message-list {
    flex: 1;
    overflow: auto;
    min-height: 100px;
  }
  .mono {
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .selected {
    background: var(--vscode-list-activeSelectionBackground) !important;
    color: var(--vscode-list-activeSelectionForeground);
  }
  .detail-pane {
    border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    max-height: 40vh;
    overflow: auto;
    padding: 8px;
    flex-shrink: 0;
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .section {
    margin-bottom: 12px;
  }
  .section h4 {
    margin: 4px 0;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
  }
  .headers-table {
    width: auto;
  }
  .header-key {
    font-weight: 600;
    white-space: nowrap;
  }
</style>
