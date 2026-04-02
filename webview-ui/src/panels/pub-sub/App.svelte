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

  interface Template {
    name: string;
    subject: string;
    payload: string;
    headers: { key: string; value: string }[];
  }

  let connectionId = $state("");
  let activeTab = $state<"subscribe" | "publish" | "request">("subscribe");

  // Subscribe state
  let subSubject = $state(">");
  let subscriptions = $state<{ id: string; subject: string; color: string }[]>([]);
  let receivedMessages = $state<NatsMessage[]>([]);
  let paused = $state(false);
  let msgCount = $state(0);
  let filterPattern = $state("");
  let expandedMsg = $state<number | null>(null);

  // Rate tracking
  let msgRate = $state(0);
  let rateCounter = 0;

  // Publish state
  let pubSubject = $state("");
  let pubPayload = $state("");
  let pubHeaders = $state<{ key: string; value: string }[]>([]);

  // Template state
  let templates = $state<Template[]>([]);
  let templateName = $state("");

  // Saved subscriptions (bookmarks)
  let savedSubscriptions = $state<{ name: string; subject: string }[]>([]);
  let savingSubId = $state<string | null>(null);
  let saveSubName = $state("");

  // Request state
  let reqSubject = $state("");
  let reqPayload = $state("");
  let reqTimeout = $state(5000);
  let reqResponse = $state<NatsMessage | null>(null);
  let reqDuration = $state(0);
  let reqError = $state("");
  let reqLoading = $state(false);

  // Derived: filtered messages
  let filterRegex = $derived.by(() => {
    if (!filterPattern.trim()) return null;
    try { return new RegExp(filterPattern, "i"); }
    catch { return null; }
  });

  let filteredMessages = $derived(
    filterRegex
      ? receivedMessages.filter(m =>
          filterRegex!.test(m.subject) || filterRegex!.test(m.payload))
      : receivedMessages
  );

  // Load templates from webview state
  $effect(() => {
    const saved = vscode.getState() as { templates?: Template[] } | null;
    if (saved?.templates) templates = saved.templates;
  });

  function saveTemplates() {
    vscode.setState({ templates });
  }

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
        vscode.postMessage({ type: "bookmarks:list" });
      } else if (msg.type === "bookmarks:data") {
        savedSubscriptions = msg.subscriptions ?? [];
      } else if (msg.type === "subscription:message" && !paused) {
        receivedMessages = [...receivedMessages.slice(-4999), msg.message];
        msgCount++;
        rateCounter++;
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

    // Rate counter
    const rateInterval = setInterval(() => {
      msgRate = rateCounter;
      rateCounter = 0;
    }, 1000);

    return () => {
      window.removeEventListener("message", handler);
      clearInterval(rateInterval);
    };
  });

  function hashColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return `hsl(${Math.abs(hash) % 360}, 70%, 65%)`;
  }

  function subscribe() {
    if (!subSubject.trim()) return;
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const color = hashColor(subSubject.trim());
    vscode.postMessage({ type: "subscribe", connectionId, subject: subSubject.trim(), id });
    subscriptions = [...subscriptions, { id, subject: subSubject.trim(), color }];
  }

  function unsubscribe(id: string) {
    vscode.postMessage({ type: "unsubscribe", id });
    subscriptions = subscriptions.filter((s) => s.id !== id);
  }

  function clearMessages() { receivedMessages = []; msgCount = 0; }

  function publish() {
    if (!pubSubject.trim()) return;
    const hdrs: Record<string, string> = {};
    for (const h of pubHeaders) {
      if (h.key.trim()) hdrs[h.key.trim()] = h.value;
    }
    vscode.postMessage({
      type: "publish", connectionId, subject: pubSubject.trim(),
      payload: pubPayload,
      headers: Object.keys(hdrs).length > 0 ? hdrs : undefined,
    });
  }

  function sendRequest() {
    if (!reqSubject.trim()) return;
    reqLoading = true; reqResponse = null; reqError = "";
    vscode.postMessage({
      type: "request", connectionId, subject: reqSubject.trim(),
      payload: reqPayload, timeout: reqTimeout,
    });
  }

  function addHeader() { pubHeaders = [...pubHeaders, { key: "", value: "" }]; }
  function removeHeader(index: number) { pubHeaders = pubHeaders.filter((_, i) => i !== index); }

  function saveTemplate() {
    if (!templateName.trim()) return;
    templates = [...templates.filter(t => t.name !== templateName.trim()), {
      name: templateName.trim(), subject: pubSubject, payload: pubPayload,
      headers: pubHeaders.filter(h => h.key.trim()),
    }];
    saveTemplates();
    templateName = "";
  }

  function loadTemplate(t: Template) {
    pubSubject = t.subject;
    pubPayload = t.payload;
    pubHeaders = t.headers.length > 0 ? [...t.headers] : [];
  }

  function deleteTemplate(name: string) {
    templates = templates.filter(t => t.name !== name);
    saveTemplates();
  }

  function startSaveSub(id: string) {
    savingSubId = id;
    saveSubName = "";
  }

  function confirmSaveSub(subject: string) {
    if (!saveSubName.trim()) return;
    vscode.postMessage({ type: "bookmarks:saveSubscription", name: saveSubName.trim(), subject });
    savingSubId = null;
    saveSubName = "";
  }

  function cancelSaveSub() {
    savingSubId = null;
    saveSubName = "";
  }

  function deleteSavedSub(name: string) {
    vscode.postMessage({ type: "bookmarks:deleteSubscription", name });
  }

  function loadSavedSub(subject: string) {
    subSubject = subject;
    subscribe();
  }

  function exportMessages() {
    const data = JSON.stringify(receivedMessages, null, 2);
    vscode.postMessage({ type: "export:messages", data });
  }

  function formatPayload(msg: NatsMessage): string {
    if (msg.payloadEncoding === "base64") return `[base64] ${msg.payload}`;
    try { return JSON.stringify(JSON.parse(msg.payload), null, 2); }
    catch { return msg.payload; }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function getSubjectColor(subject: string): string {
    const sub = subscriptions.find(s => subject.startsWith(s.subject.replace(/[*>]/g, "")));
    return sub?.color ?? "var(--vscode-foreground)";
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
        <input type="text" bind:value={subSubject} placeholder="Subject (e.g. orders.>)"
          class="subject-input" onkeydown={(e) => e.key === "Enter" && subscribe()} />
        <button onclick={subscribe}>Subscribe</button>
      </div>

      {#if savedSubscriptions.length > 0}
        <div class="saved-subs">
          <span class="saved-label">Saved:</span>
          {#each savedSubscriptions as saved}
            <button class="secondary small" onclick={() => loadSavedSub(saved.subject)} title={saved.subject}>{saved.name}</button>
            <button class="secondary small delete-btn" onclick={() => deleteSavedSub(saved.name)}>&times;</button>
          {/each}
        </div>
      {/if}

      {#if subscriptions.length > 0}
        <div class="sub-list">
          {#each subscriptions as sub}
            <span class="sub-tag" style="border-left: 3px solid {sub.color}">
              {sub.subject}
              {#if savingSubId === sub.id}
                <input
                  type="text"
                  bind:value={saveSubName}
                  placeholder="Name..."
                  class="save-sub-input"
                  onkeydown={(e) => {
                    if (e.key === "Enter") confirmSaveSub(sub.subject);
                    if (e.key === "Escape") cancelSaveSub();
                  }}
                />
                <button class="sub-remove" onclick={() => confirmSaveSub(sub.subject)} title="Save">&#x2713;</button>
                <button class="sub-remove" onclick={cancelSaveSub} title="Cancel">&times;</button>
              {:else}
                <button class="sub-remove" onclick={() => startSaveSub(sub.id)} title="Save subscription">&#x2605;</button>
                <button class="sub-remove" onclick={() => unsubscribe(sub.id)}>&times;</button>
              {/if}
            </span>
          {/each}
        </div>
      {/if}

      <div class="filter-row">
        <input type="text" bind:value={filterPattern} placeholder="Filter regex (subject or payload)..."
          class="filter-input" class:invalid={filterPattern && !filterRegex} />
        {#if filterPattern && filteredMessages.length !== receivedMessages.length}
          <span class="filter-count">{filteredMessages.length} / {receivedMessages.length}</span>
        {/if}
      </div>

      <div class="msg-controls">
        <span class="msg-count">{msgCount} messages {msgRate > 0 ? `(${msgRate}/s)` : ""}</span>
        <button class="secondary" onclick={() => (paused = !paused)}>{paused ? "Resume" : "Pause"}</button>
        <button class="secondary" onclick={clearMessages}>Clear</button>
        {#if receivedMessages.length > 0}
          <button class="secondary" onclick={exportMessages}>Export</button>
        {/if}
      </div>

      <VirtualList items={filteredMessages} itemHeight={52}>
        {#snippet children({ item, index })}
          {@const msg = item as NatsMessage}
          <div class="feed-item" class:expanded={expandedMsg === index} onclick={() => expandedMsg = expandedMsg === index ? null : index}>
            <div class="feed-meta">
              <span class="feed-subject" style="color: {getSubjectColor(msg.subject)}">{msg.subject}</span>
              <span class="feed-size">{formatSize(msg.size)}</span>
            </div>
            {#if expandedMsg === index}
              <pre class="feed-payload-expanded">{formatPayload(msg)}</pre>
            {:else}
              <div class="feed-preview">{msg.payload.slice(0, 120)}{msg.payload.length > 120 ? "..." : ""}</div>
            {/if}
          </div>
        {/snippet}
      </VirtualList>

      {#if filteredMessages.length === 0}
        <div class="empty">Waiting for messages...</div>
      {/if}
    </div>

  {:else if activeTab === "publish"}
    <div class="panel">
      {#if templates.length > 0}
        <div class="templates-bar">
          <span class="templates-label">Templates:</span>
          {#each templates as t}
            <button class="secondary small" onclick={() => loadTemplate(t)} title={t.subject}>{t.name}</button>
            <button class="secondary small delete-btn" onclick={() => deleteTemplate(t.name)}>&times;</button>
          {/each}
        </div>
      {/if}

      <div class="field">
        <label for="pub-subject">Subject</label>
        <input id="pub-subject" type="text" bind:value={pubSubject} placeholder="e.g. orders.created" />
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
        <label for="pub-payload">Payload</label>
        <textarea id="pub-payload" bind:value={pubPayload} rows={8} placeholder="Message payload..."></textarea>
      </div>

      <div class="button-row">
        <button onclick={publish}>Publish</button>
        <div class="save-template">
          <input type="text" bind:value={templateName} placeholder="Template name..." class="template-name" />
          <button class="secondary" onclick={saveTemplate} disabled={!templateName.trim()}>Save Template</button>
        </div>
      </div>
    </div>

  {:else if activeTab === "request"}
    <div class="panel">
      <div class="field">
        <label for="req-subject">Subject</label>
        <input id="req-subject" type="text" bind:value={reqSubject} placeholder="e.g. service.endpoint" />
      </div>
      <div class="field">
        <label for="req-timeout">Timeout (ms)</label>
        <input id="req-timeout" type="number" bind:value={reqTimeout} />
      </div>
      <div class="field">
        <label for="req-payload">Payload</label>
        <textarea id="req-payload" bind:value={reqPayload} rows={6} placeholder="Request payload..."></textarea>
      </div>
      <button onclick={sendRequest} disabled={reqLoading}>{reqLoading ? "Waiting..." : "Send Request"}</button>
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
  main { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .tabs { display: flex; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); flex-shrink: 0; }
  .tabs button { flex: 1; padding: 8px; background: none; color: var(--vscode-foreground); border: none; border-bottom: 2px solid transparent; cursor: pointer; }
  .tabs button.active { border-bottom-color: var(--vscode-focusBorder); color: var(--vscode-focusBorder); }
  .panel { flex: 1; overflow: auto; padding: 8px; display: flex; flex-direction: column; }
  .input-row { display: flex; gap: 4px; margin-bottom: 8px; }
  .subject-input { flex: 1; }
  .sub-list { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
  .sub-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 0.85em; }
  .sub-remove { background: none; border: none; color: inherit; padding: 0 2px; cursor: pointer; font-size: 1.1em; }
  .filter-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
  .filter-input { flex: 1; }
  .filter-input.invalid { border-color: var(--vscode-inputValidation-errorBorder, #be1100); }
  .filter-count { font-size: 0.85em; color: var(--vscode-descriptionForeground); white-space: nowrap; }
  .msg-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-shrink: 0; }
  .msg-count { flex: 1; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  .feed-item { border-bottom: 1px solid var(--vscode-widget-border, transparent); padding: 4px 8px; cursor: pointer; }
  .feed-item:hover { background: var(--vscode-list-hoverBackground); }
  .feed-meta { display: flex; justify-content: space-between; font-size: 0.85em; }
  .feed-subject { font-weight: 600; }
  .feed-size { color: var(--vscode-descriptionForeground); }
  .feed-preview { font-family: var(--vscode-editor-font-family); font-size: 0.8em; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .feed-payload-expanded { margin: 4px 0 0 0; padding: 4px; font-size: 0.8em; max-height: 200px; overflow: auto; }
  .empty { padding: 24px; text-align: center; color: var(--vscode-descriptionForeground); }
  .field { margin-bottom: 12px; }
  .field label { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-weight: 600; font-size: 0.9em; }
  .field input, .field textarea { width: 100%; }
  .field textarea { font-family: var(--vscode-editor-font-family); resize: vertical; }
  .header-row { display: flex; gap: 4px; margin-bottom: 4px; }
  .header-row input { flex: 1; }
  .small { padding: 2px 6px; font-size: 0.85em; }
  .button-row { display: flex; gap: 8px; align-items: center; }
  .save-template { display: flex; gap: 4px; align-items: center; margin-left: auto; }
  .template-name { width: 140px; }
  .templates-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 12px; padding: 6px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); border-radius: 4px; }
  .templates-label { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-right: 4px; }
  .delete-btn { color: var(--vscode-errorForeground); padding: 2px 4px; }
  .saved-subs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 8px; padding: 6px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); border-radius: 4px; }
  .saved-label { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-right: 4px; }
  .save-sub-input { width: 80px; padding: 1px 4px; font-size: 0.85em; }
  .response { margin-top: 12px; border: 1px solid var(--vscode-widget-border, transparent); border-radius: 4px; padding: 8px; }
  .response h4 { margin: 0 0 4px 0; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
  .error-msg { margin-top: 8px; padding: 8px; background: var(--vscode-inputValidation-errorBackground, #5a1d1d); border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100); border-radius: 4px; color: var(--vscode-errorForeground); }
</style>
