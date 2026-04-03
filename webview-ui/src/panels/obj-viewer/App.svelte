<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import CopyButton from "../../lib/CopyButton.svelte";
  import KeyValue from "../../lib/KeyValue.svelte";
  import EmptyState from "../../lib/EmptyState.svelte";

  interface ObjectInfo {
    name: string;
    size: number;
    chunks: number;
    lastModified: string;
    digest: string;
  }

  let connectionId = $state("");
  let store = $state("");
  let objectName = $state("");
  let info = $state<ObjectInfo | null>(null);
  let loading = $state(true);
  let confirmingDelete = $state(false);

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
        store = msg.store;
        objectName = msg.name;
        fetchInfo();
      } else if (msg.type === "obj:info:data") {
        info = msg.info;
        loading = false;
      } else if (msg.type === "error") {
        loading = false;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  function fetchInfo() {
    loading = true;
    vscode.postMessage({
      type: "obj:info",
      connectionId,
      store,
      name: objectName,
    });
  }

  function deleteObject() {
    if (!confirmingDelete) {
      confirmingDelete = true;
      return;
    }
    vscode.postMessage({
      type: "obj:delete",
      connectionId,
      store,
      name: objectName,
    });
    confirmingDelete = false;
  }

  function cancelDelete() {
    confirmingDelete = false;
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function formatTimestamp(ts: string): string {
    if (!ts) return "-";
    return ts.replace("T", " ").replace("Z", " UTC");
  }

  function formatDigest(digest: string): string {
    // Insert a space every 8 characters for readability
    return digest.replace(/(.{8})/g, "$1 ").trim();
  }
</script>

<main>
  <!-- Breadcrumb header -->
  <div class="obj-header">
    <div class="breadcrumb">
      <span class="breadcrumb-store">{store}</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-name">{objectName}</span>
    </div>
  </div>

  {#if loading}
    <EmptyState state="loading" message="Loading object info..." />
  {:else if !info}
    <EmptyState state="error" message="Object not found." />
  {:else}
    <!-- Actions toolbar -->
    <div class="toolbar">
      <button class="secondary" onclick={fetchInfo}>Refresh</button>
      <div class="spacer"></div>
      {#if confirmingDelete}
        <span class="confirm-label">Confirm delete?</span>
        <button class="danger" onclick={deleteObject}>Confirm Delete</button>
        <button class="secondary" onclick={cancelDelete}>Cancel</button>
      {:else}
        <button class="danger" onclick={deleteObject}>Delete</button>
      {/if}
    </div>

    <!-- Metadata card -->
    <div class="detail-card">
      <div class="panel-section">
        <KeyValue label="Name" value={info.name} mono copyable />
        <KeyValue
          label="Size"
          value={`${formatBytes(info.size)} (${info.size.toLocaleString()} bytes)`}
          copyable
        />
        <KeyValue label="Chunks" value={String(info.chunks)} />
        <KeyValue
          label="Last Modified"
          value={formatTimestamp(info.lastModified)}
          mono
          copyable
        />
      </div>

      <div class="panel-section">
        <div class="digest-row">
          <dt class="digest-label">Digest</dt>
          <dd class="digest-value">
            <code class="digest-code">{formatDigest(info.digest)}</code>
            <CopyButton text={info.digest} label="Copy digest" />
          </dd>
        </div>
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

  .obj-header {
    padding: var(--space-3);
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    flex-shrink: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 1.05em;
  }

  .breadcrumb-store {
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
  }

  .breadcrumb-sep {
    color: var(--vscode-descriptionForeground);
    margin: 0 4px;
  }

  .breadcrumb-name {
    font-weight: 600;
  }

  .spacer {
    flex: 1;
  }

  .confirm-label {
    color: var(--vscode-errorForeground);
    font-size: 0.9em;
    font-weight: 500;
  }

  .detail-card {
    flex: 1;
    overflow: auto;
    margin: var(--space-3);
    border: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    border-radius: var(--radius-lg);
    background: var(
      --vscode-sideBar-background,
      var(--vscode-editor-background)
    );
  }

  .detail-card .panel-section:last-child {
    border-bottom: none;
  }

  .digest-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: 3px 0;
  }

  .digest-label {
    color: var(--vscode-descriptionForeground);
    font-size: 0.85em;
    min-width: 90px;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .digest-value {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    flex-wrap: wrap;
  }

  .digest-code {
    word-break: break-all;
    letter-spacing: 0.5px;
  }
</style>
