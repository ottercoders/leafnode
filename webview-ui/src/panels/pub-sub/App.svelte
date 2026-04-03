<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import VirtualList from "../../lib/VirtualList.svelte";
  import JsonViewer from "../../lib/JsonViewer.svelte";
  import CopyButton from "../../lib/CopyButton.svelte";
  import StatusBadge from "../../lib/StatusBadge.svelte";
  import EmptyState from "../../lib/EmptyState.svelte";
  import KeyValue from "../../lib/KeyValue.svelte";
  import Sparkline from "../../lib/Sparkline.svelte";

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
  let rateHistory = $state<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Publish state
  let pubSubject = $state("");
  let pubPayload = $state("");
  let pubHeaders = $state<{ key: string; value: string }[]>([]);
  let publishedFeedback = $state(false);

  // Template state
  let templates = $state<Template[]>([]);
  let templateName = $state("");
  let selectedTemplate = $state("");

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

  let filterMatchCount = $derived(
    filterPattern.trim() ? filteredMessages.length : -1
  );

  // Parsed response payload
  let parsedResponse = $derived.by(() => {
    if (!reqResponse) return null;
    if (reqResponse.payloadEncoding === "base64") return null;
    try { return JSON.parse(reqResponse.payload); } catch { return null; }
  });

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
      rateHistory = [...rateHistory.slice(1), rateCounter];
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
    publishedFeedback = true;
    setTimeout(() => { publishedFeedback = false; }, 1500);
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

  function loadTemplateByName(name: string) {
    const t = templates.find(tmpl => tmpl.name === name);
    if (t) loadTemplate(t);
  }

  function deleteTemplate(name: string) {
    templates = templates.filter(t => t.name !== name);
    saveTemplates();
    if (selectedTemplate === name) selectedTemplate = "";
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

  function tryParseJson(payload: string): unknown | null {
    try { return JSON.parse(payload); } catch { return null; }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return ts; }
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

  <!-- ==================== SUBSCRIBE TAB ==================== -->
  {#if activeTab === "subscribe"}
    <div class="panel">
      <!-- Saved subscriptions -->
      {#if savedSubscriptions.length > 0}
        <div class="saved-bar">
          {#each savedSubscriptions as saved}
            <button class="saved-btn" onclick={() => loadSavedSub(saved.subject)} title={saved.subject}>
              &#x2605; {saved.name}
            </button>
            <button class="icon-btn delete-x" onclick={() => deleteSavedSub(saved.name)} title="Remove saved">&times;</button>
          {/each}
        </div>
      {/if}

      <!-- Subject input -->
      <div class="sub-input-row">
        <input type="text" bind:value={subSubject} placeholder="Subject (e.g. orders.>)"
          class="subject-input" onkeydown={(e) => e.key === "Enter" && subscribe()} />
        <button onclick={subscribe}>Subscribe</button>
      </div>
      <div class="input-hint">Use <code>*</code> for single token, <code>&gt;</code> for multiple</div>

      <!-- Active subscriptions -->
      {#if subscriptions.length > 0}
        <div class="sub-pills">
          {#each subscriptions as sub}
            <span class="sub-pill">
              <span class="sub-dot" style="background: {sub.color}"></span>
              <span class="sub-label">{sub.subject}</span>
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
                <button class="icon-btn pill-action" onclick={() => confirmSaveSub(sub.subject)} title="Confirm">&#10003;</button>
                <button class="icon-btn pill-action" onclick={cancelSaveSub} title="Cancel">&times;</button>
              {:else}
                <button class="icon-btn pill-action" onclick={() => startSaveSub(sub.id)} title="Save subscription">&#x2605;</button>
                <button class="icon-btn pill-action" onclick={() => unsubscribe(sub.id)} title="Unsubscribe">&times;</button>
              {/if}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Filter -->
      <div class="filter-row">
        <input type="text" bind:value={filterPattern} placeholder="Filter regex (subject or payload)..."
          class="filter-input" class:invalid={filterPattern && !filterRegex} />
        {#if filterMatchCount >= 0}
          <StatusBadge status="info" label="{filteredMessages.length} / {receivedMessages.length} matched" />
        {/if}
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stats-left">
          <span class="stat-count">{msgCount.toLocaleString()} messages</span>
          {#if msgRate > 0}
            <StatusBadge status="success" label="{msgRate}/s" />
          {/if}
        </div>
        <div class="stats-right">
          <Sparkline values={rateHistory} fill showValue height={22} />
          <button class="secondary small" onclick={() => (paused = !paused)}>
            {paused ? "&#9654; Resume" : "&#10074;&#10074; Pause"}
          </button>
          <button class="secondary small" onclick={clearMessages}>Clear</button>
          {#if receivedMessages.length > 0}
            <button class="secondary small" onclick={exportMessages}>Export</button>
          {/if}
        </div>
      </div>

      <!-- Message feed -->
      {#if filteredMessages.length === 0}
        <EmptyState state="empty" message="Waiting for messages..." />
      {:else}
        <VirtualList items={filteredMessages} itemHeight={56} totalLabel="messages">
          {#snippet children({ item, index })}
            {@const msg = item as NatsMessage}
            <div class="feed-row" class:expanded={expandedMsg === index} onclick={() => expandedMsg = expandedMsg === index ? null : index}>
              <div class="feed-top">
                <span class="feed-subject" style="color: {getSubjectColor(msg.subject)}">{msg.subject}</span>
                <span class="feed-meta-right">
                  <span class="feed-time mono">{formatTimestamp(msg.timestamp)}</span>
                  <span class="badge info">{formatSize(msg.size)}</span>
                </span>
              </div>
              <div class="feed-preview mono">{msg.payload.slice(0, 100)}{msg.payload.length > 100 ? "..." : ""}</div>
            </div>
          {/snippet}
        </VirtualList>
      {/if}

      <!-- Expanded message overlay -->
      {#if expandedMsg !== null && filteredMessages[expandedMsg]}
        {@const exMsg = filteredMessages[expandedMsg]}
        <div class="expanded-pane">
          <div class="expanded-header">
            <span class="feed-subject" style="color: {getSubjectColor(exMsg.subject)}">{exMsg.subject}</span>
            <div class="expanded-actions">
              <CopyButton text={exMsg.payload} label="Copy payload" />
              <button class="icon-btn" onclick={() => expandedMsg = null} title="Close">&times;</button>
            </div>
          </div>
          {#if exMsg.headers && Object.keys(exMsg.headers).length > 0}
            <div class="expanded-section">
              <div class="expanded-section-title">Headers</div>
              {#each Object.entries(exMsg.headers) as [key, values]}
                <KeyValue label={key} value={values.join(", ")} mono />
              {/each}
            </div>
          {/if}
          <div class="expanded-section">
            {#if exMsg.payloadEncoding === "base64"}
              <pre>[base64] {exMsg.payload}</pre>
            {:else if tryParseJson(exMsg.payload) !== null}
              <JsonViewer data={tryParseJson(exMsg.payload)} />
            {:else}
              <pre>{exMsg.payload}</pre>
            {/if}
          </div>
        </div>
      {/if}
    </div>

  <!-- ==================== PUBLISH TAB ==================== -->
  {:else if activeTab === "publish"}
    <div class="panel pub-panel">
      <!-- Templates -->
      {#if templates.length > 0}
        <div class="template-section">
          <div class="template-row">
            <select class="template-select" bind:value={selectedTemplate} onchange={() => selectedTemplate && loadTemplateByName(selectedTemplate)}>
              <option value="">-- Select template --</option>
              {#each templates as t}
                <option value={t.name}>{t.name} ({t.subject})</option>
              {/each}
            </select>
            {#if selectedTemplate}
              <button class="icon-btn" onclick={() => deleteTemplate(selectedTemplate)} title="Delete template">&#128465;</button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Subject -->
      <div class="field">
        <label for="pub-subject">Subject</label>
        <input id="pub-subject" type="text" bind:value={pubSubject} placeholder="e.g. orders.created" />
      </div>

      <!-- Headers -->
      <div class="field">
        <div class="field-header">
          <label>Headers</label>
          <button class="secondary small" onclick={addHeader}>+ Add Header</button>
        </div>
        {#if pubHeaders.length > 0}
          <div class="headers-grid">
            {#each pubHeaders as header, i}
              <div class="header-row">
                <input type="text" bind:value={header.key} placeholder="Header name" />
                <input type="text" bind:value={header.value} placeholder="Header value" />
                <button class="icon-btn" onclick={() => removeHeader(i)} title="Remove header">&times;</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Payload -->
      <div class="field payload-field">
        <label for="pub-payload">Payload</label>
        <textarea id="pub-payload" bind:value={pubPayload} rows={12} placeholder="Message payload..." class="mono-textarea"></textarea>
      </div>

      <!-- Publish button -->
      <button class="publish-btn" onclick={publish} disabled={!pubSubject.trim()}>
        {#if publishedFeedback}
          &#10003; Sent
        {:else}
          Publish Message
        {/if}
      </button>

      <!-- Save template -->
      <div class="save-template-row">
        <input type="text" bind:value={templateName} placeholder="Template name..." class="template-name-input" />
        <button class="secondary" onclick={saveTemplate} disabled={!templateName.trim()}>Save as Template</button>
      </div>
    </div>

  <!-- ==================== REQUEST TAB ==================== -->
  {:else if activeTab === "request"}
    <div class="panel req-panel">
      <!-- Subject -->
      <div class="field">
        <label for="req-subject">Subject</label>
        <input id="req-subject" type="text" bind:value={reqSubject} placeholder="e.g. service.endpoint" />
      </div>

      <!-- Payload -->
      <div class="field">
        <label for="req-payload">Payload</label>
        <textarea id="req-payload" bind:value={reqPayload} rows={6} placeholder="Request payload..." class="mono-textarea"></textarea>
      </div>

      <!-- Timeout -->
      <div class="field">
        <label for="req-timeout">Timeout</label>
        <select id="req-timeout" bind:value={reqTimeout}>
          <option value={1000}>1 second</option>
          <option value={5000}>5 seconds</option>
          <option value={10000}>10 seconds</option>
          <option value={30000}>30 seconds</option>
        </select>
      </div>

      <!-- Send button -->
      <button class="publish-btn" onclick={sendRequest} disabled={reqLoading || !reqSubject.trim()}>
        {#if reqLoading}
          Waiting for response...
        {:else}
          Send Request
        {/if}
      </button>

      <!-- Response -->
      {#if reqResponse}
        <div class="response-section">
          <div class="response-header">
            <StatusBadge status="success" label="Response received" />
            <span class="badge info">{reqDuration}ms</span>
          </div>
          <div class="response-body">
            {#if parsedResponse !== null}
              <JsonViewer data={parsedResponse} />
            {:else}
              <pre>{formatPayload(reqResponse)}</pre>
            {/if}
          </div>
        </div>
      {/if}

      {#if reqError}
        <EmptyState state="error" message={reqError} />
      {/if}
    </div>
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .panel { flex: 1; overflow: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }

  /* ---- Subscribe tab ---- */
  .saved-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 6px 8px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); border-radius: var(--radius); }
  .saved-btn { min-height: 22px; padding: 2px 8px; font-size: 0.82em; background: none; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.3)); color: var(--vscode-textLink-foreground); border-radius: 10px; }
  .saved-btn:hover { background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31)); }
  .delete-x { margin-left: -6px; font-size: 0.85em; }

  .sub-input-row { display: flex; gap: 4px; }
  .subject-input { flex: 1; }
  .input-hint { font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: -4px; }
  .input-hint code { font-size: 1em; padding: 0 3px; }

  .sub-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .sub-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 6px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 12px; font-size: 0.85em; }
  .sub-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sub-label { white-space: nowrap; }
  .pill-action { padding: 0 2px !important; min-height: auto !important; font-size: 1em; }
  .save-sub-input { width: 80px; padding: 1px 4px; font-size: 0.85em; border-radius: 3px; }

  .filter-row { display: flex; gap: 8px; align-items: center; }
  .filter-input { flex: 1; }
  .filter-input.invalid { border-color: var(--vscode-inputValidation-errorBorder, #be1100); }

  .stats-bar { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; flex-shrink: 0; }
  .stats-left { display: flex; align-items: center; gap: 8px; }
  .stat-count { font-size: 0.9em; color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
  .stats-right { display: flex; align-items: center; gap: 6px; }

  /* Feed rows */
  .feed-row { padding: 4px 8px; cursor: pointer; border-bottom: 1px solid var(--vscode-widget-border, transparent); height: 100%; display: flex; flex-direction: column; justify-content: center; }
  .feed-row:hover { background: var(--vscode-list-hoverBackground); }
  .feed-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .feed-subject { font-weight: 600; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .feed-meta-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .feed-time { font-size: 0.8em; color: var(--vscode-descriptionForeground); }
  .feed-preview { font-size: 0.8em; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }

  /* Expanded message */
  .expanded-pane { border-top: 2px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); max-height: 40vh; overflow: auto; padding: 8px 12px; flex-shrink: 0; }
  .expanded-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .expanded-actions { display: flex; align-items: center; gap: 4px; }
  .expanded-section { margin-bottom: 8px; }
  .expanded-section-title { font-size: 0.8em; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px; }

  /* ---- Publish tab ---- */
  .pub-panel { gap: 12px; }
  .template-section { margin-bottom: 4px; }
  .template-row { display: flex; gap: 4px; align-items: center; }
  .template-select { flex: 1; min-height: 28px; }

  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-weight: 600; font-size: 0.9em; }
  .field input, .field textarea, .field select { width: 100%; }
  .field-header { display: flex; align-items: center; justify-content: space-between; }
  .headers-grid { display: flex; flex-direction: column; gap: 4px; }
  .header-row { display: flex; gap: 4px; align-items: center; }
  .header-row input { flex: 1; }
  .payload-field { flex: 1; min-height: 0; }
  .mono-textarea { font-family: var(--vscode-editor-font-family); resize: vertical; }

  .publish-btn { width: 100%; min-height: 34px; font-weight: 600; }
  .save-template-row { display: flex; gap: 4px; align-items: center; }
  .template-name-input { flex: 1; }

  /* ---- Request tab ---- */
  .req-panel { gap: 12px; }
  .response-section { margin-top: 8px; border: 1px solid var(--vscode-widget-border, transparent); border-radius: var(--radius-lg); overflow: hidden; }
  .response-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); border-bottom: 1px solid var(--vscode-widget-border, transparent); }
  .response-body { padding: 8px 12px; }
</style>
