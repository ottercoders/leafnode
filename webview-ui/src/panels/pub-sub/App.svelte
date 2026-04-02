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
  let activeTab = $state<"subscribe" | "publish" | "request">("subscribe");

  // Subscribe state
  let subSubject = $state(">");
  let subscriptions = $state<{ id: string; subject: string }[]>([]);
  let receivedMessages = $state<NatsMessage[]>([]);
  let paused = $state(false);
  let msgCount = $state(0);

  // Publish state
  let pubSubject = $state("");
  let pubPayload = $state("");
  let pubHeaders = $state<{ key: string; value: string }[]>([]);

  // Request state
  let reqSubject = $state("");
  let reqPayload = $state("");
  let reqTimeout = $state(5000);
  let reqResponse = $state<NatsMessage | null>(null);
  let reqDuration = $state(0);
  let reqError = $state("");
  let reqLoading = $state(false);

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
      } else if (msg.type === "subscription:message" && !paused) {
        receivedMessages = [...receivedMessages.slice(-999), msg.message];
        msgCount++;
      } else if (msg.type === "request:response") {
        reqResponse = msg.message;
        reqDuration = msg.durationMs;
        reqError = "";
        reqLoading = false;
      } else if (msg.type === "request:error") {
        reqError = msg.error;
        reqResponse = null;
        reqLoading = false;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  function subscribe() {
    if (!subSubject.trim()) return;
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    vscode.postMessage({
      type: "subscribe",
      connectionId,
      subject: subSubject.trim(),
      id,
    });
    subscriptions = [...subscriptions, { id, subject: subSubject.trim() }];
  }

  function unsubscribe(id: string) {
    vscode.postMessage({ type: "unsubscribe", id });
    subscriptions = subscriptions.filter((s) => s.id !== id);
  }

  function clearMessages() {
    receivedMessages = [];
    msgCount = 0;
  }

  function publish() {
    if (!pubSubject.trim()) return;
    const hdrs: Record<string, string> = {};
    for (const h of pubHeaders) {
      if (h.key.trim()) hdrs[h.key.trim()] = h.value;
    }
    vscode.postMessage({
      type: "publish",
      connectionId,
      subject: pubSubject.trim(),
      payload: pubPayload,
      headers: Object.keys(hdrs).length > 0 ? hdrs : undefined,
    });
  }

  function sendRequest() {
    if (!reqSubject.trim()) return;
    reqLoading = true;
    reqResponse = null;
    reqError = "";
    vscode.postMessage({
      type: "request",
      connectionId,
      subject: reqSubject.trim(),
      payload: reqPayload,
      timeout: reqTimeout,
    });
  }

  function addHeader() {
    pubHeaders = [...pubHeaders, { key: "", value: "" }];
  }

  function removeHeader(index: number) {
    pubHeaders = pubHeaders.filter((_, i) => i !== index);
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
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
</script>

<main>
  <div class="tabs">
    <button class:active={activeTab === "subscribe"} onclick={() => (activeTab = "subscribe")}>Subscribe</button>
    <button class:active={activeTab === "publish"} onclick={() => (activeTab = "publish")}>Publish</button>
    <button class:active={activeTab === "request"} onclick={() => (activeTab = "request")}>Request</button>
  </div>

  {#if activeTab === "subscribe"}
    <div class="panel">
      <div class="input-row">
        <input
          type="text"
          bind:value={subSubject}
          placeholder="Subject (e.g. orders.>)"
          class="subject-input"
          onkeydown={(e) => e.key === "Enter" && subscribe()}
        />
        <button onclick={subscribe}>Subscribe</button>
      </div>

      {#if subscriptions.length > 0}
        <div class="sub-list">
          {#each subscriptions as sub}
            <span class="sub-tag">
              {sub.subject}
              <button class="sub-remove" onclick={() => unsubscribe(sub.id)}>&times;</button>
            </span>
          {/each}
        </div>
      {/if}

      <div class="msg-controls">
        <span class="msg-count">{msgCount} messages</span>
        <button class="secondary" onclick={() => (paused = !paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button class="secondary" onclick={clearMessages}>Clear</button>
      </div>

      <div class="message-feed">
        {#each receivedMessages as msg}
          <div class="feed-item">
            <div class="feed-meta">
              <span class="feed-subject">{msg.subject}</span>
              <span class="feed-size">{formatSize(msg.size)}</span>
            </div>
            <pre class="feed-payload">{formatPayload(msg)}</pre>
          </div>
        {/each}
        {#if receivedMessages.length === 0}
          <div class="empty">Waiting for messages...</div>
        {/if}
      </div>
    </div>

  {:else if activeTab === "publish"}
    <div class="panel">
      <div class="field">
        <label>Subject</label>
        <input type="text" bind:value={pubSubject} placeholder="e.g. orders.created" />
      </div>

      <div class="field">
        <label>
          Headers
          <button class="secondary small" onclick={addHeader}>+ Add</button>
        </label>
        {#each pubHeaders as header, i}
          <div class="header-row">
            <input type="text" bind:value={header.key} placeholder="Key" />
            <input type="text" bind:value={header.value} placeholder="Value" />
            <button class="secondary small" onclick={() => removeHeader(i)}>&times;</button>
          </div>
        {/each}
      </div>

      <div class="field">
        <label>Payload</label>
        <textarea bind:value={pubPayload} rows={8} placeholder="Message payload..."></textarea>
      </div>

      <button onclick={publish}>Publish</button>
    </div>

  {:else if activeTab === "request"}
    <div class="panel">
      <div class="field">
        <label>Subject</label>
        <input type="text" bind:value={reqSubject} placeholder="e.g. service.endpoint" />
      </div>

      <div class="field">
        <label>Timeout (ms)</label>
        <input type="number" bind:value={reqTimeout} />
      </div>

      <div class="field">
        <label>Payload</label>
        <textarea bind:value={reqPayload} rows={6} placeholder="Request payload..."></textarea>
      </div>

      <button onclick={sendRequest} disabled={reqLoading}>
        {reqLoading ? "Waiting..." : "Send Request"}
      </button>

      {#if reqResponse}
        <div class="response">
          <h4>Response ({reqDuration}ms)</h4>
          <pre>{formatPayload(reqResponse)}</pre>
        </div>
      {/if}

      {#if reqError}
        <div class="error-msg">{reqError}</div>
      {/if}
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
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    flex-shrink: 0;
  }
  .tabs button {
    flex: 1;
    padding: 8px;
    background: none;
    color: var(--vscode-foreground);
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tabs button.active {
    border-bottom-color: var(--vscode-focusBorder);
    color: var(--vscode-focusBorder);
  }
  .panel {
    flex: 1;
    overflow: auto;
    padding: 8px;
  }
  .input-row {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }
  .subject-input {
    flex: 1;
  }
  .sub-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  .sub-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 10px;
    font-size: 0.85em;
  }
  .sub-remove {
    background: none;
    border: none;
    color: inherit;
    padding: 0 2px;
    cursor: pointer;
    font-size: 1.1em;
  }
  .msg-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .msg-count {
    flex: 1;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
  }
  .message-feed {
    flex: 1;
    overflow: auto;
  }
  .feed-item {
    border-bottom: 1px solid var(--vscode-widget-border, transparent);
    padding: 4px 0;
  }
  .feed-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
  }
  .feed-subject {
    font-weight: 600;
  }
  .feed-size {
    color: var(--vscode-descriptionForeground);
  }
  .feed-payload {
    margin: 2px 0 0 0;
    padding: 4px;
    font-size: 0.85em;
    max-height: 100px;
    overflow: auto;
  }
  .empty {
    padding: 24px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
  }
  .field {
    margin-bottom: 12px;
  }
  .field label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-weight: 600;
    font-size: 0.9em;
  }
  .field input,
  .field textarea {
    width: 100%;
  }
  .field textarea {
    font-family: var(--vscode-editor-font-family);
    resize: vertical;
  }
  .header-row {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }
  .header-row input {
    flex: 1;
  }
  .small {
    padding: 2px 6px;
    font-size: 0.85em;
  }
  .response {
    margin-top: 12px;
    border: 1px solid var(--vscode-widget-border, transparent);
    border-radius: 4px;
    padding: 8px;
  }
  .response h4 {
    margin: 0 0 4px 0;
    font-size: 0.9em;
    color: var(--vscode-descriptionForeground);
  }
  .error-msg {
    margin-top: 8px;
    padding: 8px;
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    border-radius: 4px;
    color: var(--vscode-errorForeground);
  }
</style>
