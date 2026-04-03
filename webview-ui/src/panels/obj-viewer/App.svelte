<script lang="ts">
  import { vscode } from "../../lib/vscode-api";

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
    vscode.postMessage({ type: "obj:info", connectionId, store, name: objectName });
  }

  let confirmingDelete = $state(false);

  function deleteObject() {
    if (!confirmingDelete) {
      confirmingDelete = true;
      return;
    }
    vscode.postMessage({ type: "obj:delete", connectionId, store, name: objectName });
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
    return ts.replace("T", " ").replace("Z", "");
  }
</script>

<main>
  <div class="header">
    <div class="breadcrumb">
      <span class="store-name">{store}</span>
      <span class="sep">/</span>
      <span class="object-name">{objectName}</span>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if !info}
    <div class="empty">Object not found.</div>
  {:else}
    <div class="toolbar">
      <button class="secondary" onclick={fetchInfo}>Refresh</button>
      {#if confirmingDelete}
        <span class="confirm-text">Delete this object?</span>
        <button class="danger" onclick={deleteObject}>Confirm</button>
        <button class="secondary" onclick={cancelDelete}>Cancel</button>
      {:else}
        <button class="danger" onclick={deleteObject}>Delete</button>
      {/if}
    </div>

    <div class="info-pane">
      <table class="info-table">
        <tbody>
          <tr>
            <td class="label">Name</td>
            <td>{info.name}</td>
          </tr>
          <tr>
            <td class="label">Size</td>
            <td>{formatBytes(info.size)}</td>
          </tr>
          <tr>
            <td class="label">Chunks</td>
            <td>{info.chunks}</td>
          </tr>
          <tr>
            <td class="label">Last Modified</td>
            <td class="mono">{formatTimestamp(info.lastModified)}</td>
          </tr>
          <tr>
            <td class="label">Digest</td>
            <td class="mono digest">{info.digest}</td>
          </tr>
        </tbody>
      </table>
    </div>
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .header { padding: 8px; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); flex-shrink: 0; }
  .breadcrumb { font-weight: 600; font-size: 1.1em; display: flex; align-items: center; gap: 4px; }
  .store-name { color: var(--vscode-descriptionForeground); }
  .sep { color: var(--vscode-descriptionForeground); margin: 0 4px; }
  .toolbar { display: flex; gap: 4px; padding: 8px; flex-shrink: 0; }
  .info-pane { flex: 1; overflow: auto; padding: 0 8px; }
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td { padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent)); }
  .label { font-weight: 600; color: var(--vscode-descriptionForeground); width: 120px; white-space: nowrap; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  .digest { word-break: break-all; }
  .loading, .empty { padding: 24px; text-align: center; color: var(--vscode-descriptionForeground); }
  .danger { color: var(--vscode-errorForeground); }
  .confirm-text { color: var(--vscode-errorForeground); font-size: 0.9em; }
</style>
