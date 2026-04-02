<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import Sparkline from "../../lib/Sparkline.svelte";

  interface VarzData {
    server_id: string;
    server_name: string;
    version: string;
    go: string;
    host: string;
    port: number;
    max_connections: number;
    connections: number;
    total_connections: number;
    uptime: string;
    mem: number;
    cores: number;
    cpu: number;
    in_msgs: number;
    out_msgs: number;
    in_bytes: number;
    out_bytes: number;
    subscriptions: number;
    slow_consumers: number;
  }

  interface ConnectionInfoData {
    cid: number;
    ip: string;
    port: number;
    name: string;
    lang: string;
    version: string;
    rtt: string;
    uptime: string;
    in_msgs: number;
    out_msgs: number;
    in_bytes: number;
    out_bytes: number;
    subscriptions: number;
    pending_bytes: number;
  }

  interface ConnzData {
    num_connections: number;
    total: number;
    offset: number;
    limit: number;
    connections: ConnectionInfoData[];
  }

  interface JszData {
    server_id: string;
    now: string;
    config?: {
      max_memory: number;
      max_store: number;
      store_dir: string;
    };
    memory: number;
    storage: number;
    api: {
      total: number;
      errors: number;
    };
    total_streams: number;
    total_consumers: number;
  }

  let connectionId = $state("");
  let activeTab = $state<"server" | "connections" | "jetstream">("server");

  let varz = $state<VarzData | null>(null);
  let connz = $state<ConnzData | null>(null);
  let jsz = $state<JszData | null>(null);
  let error = $state("");

  // Sparkline history
  let cpuHistory = $state<number[]>([]);
  let memHistory = $state<number[]>([]);
  let msgsInHistory = $state<number[]>([]);
  let msgsOutHistory = $state<number[]>([]);

  const MAX_HISTORY = 30;

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let abs = Math.abs(bytes);
    let i = 0;
    while (abs >= 1024 && i < units.length - 1) {
      abs /= 1024;
      i++;
    }
    return `${i === 0 ? abs : abs.toFixed(1)} ${units[i]}`;
  }

  function formatCount(n: number): string {
    if (n < 1_000) return String(n);
    if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }

  function requestData() {
    if (!connectionId) return;
    vscode.postMessage({ type: "monitor:varz", connectionId });
    vscode.postMessage({ type: "monitor:connz", connectionId });
    vscode.postMessage({ type: "monitor:jsz", connectionId });
  }

  $effect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        connectionId = msg.connectionId;
        requestData();
      } else if (msg.type === "monitor:varz:data") {
        varz = msg.data;
        error = "";
        cpuHistory = [...cpuHistory.slice(-(MAX_HISTORY - 1)), msg.data.cpu];
        memHistory = [...memHistory.slice(-(MAX_HISTORY - 1)), msg.data.mem];
        msgsInHistory = [
          ...msgsInHistory.slice(-(MAX_HISTORY - 1)),
          msg.data.in_msgs,
        ];
        msgsOutHistory = [
          ...msgsOutHistory.slice(-(MAX_HISTORY - 1)),
          msg.data.out_msgs,
        ];
      } else if (msg.type === "monitor:connz:data") {
        connz = msg.data;
      } else if (msg.type === "monitor:jsz:data") {
        jsz = msg.data;
      } else if (msg.type === "error") {
        error = msg.message;
      }
    };
    window.addEventListener("message", handler);

    const interval = setInterval(requestData, 5000);

    return () => {
      window.removeEventListener("message", handler);
      clearInterval(interval);
    };
  });
</script>

<main>
  <div class="tabs">
    <button
      class:active={activeTab === "server"}
      onclick={() => (activeTab = "server")}>Server</button
    >
    <button
      class:active={activeTab === "connections"}
      onclick={() => (activeTab = "connections")}>Connections</button
    >
    <button
      class:active={activeTab === "jetstream"}
      onclick={() => (activeTab = "jetstream")}>JetStream</button
    >
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  {#if activeTab === "server"}
    <div class="panel">
      {#if varz}
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Server Name</div>
            <div class="stat-value">{varz.server_name || varz.server_id.slice(0, 8)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Version</div>
            <div class="stat-value">{varz.version}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">{varz.uptime}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Go</div>
            <div class="stat-value">{varz.go}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">CPU</div>
            <div class="stat-value">{varz.cpu.toFixed(1)}%</div>
            <Sparkline values={cpuHistory} color="var(--vscode-charts-yellow, #cca700)" />
          </div>
          <div class="stat-card">
            <div class="stat-label">Memory</div>
            <div class="stat-value">{formatBytes(varz.mem)}</div>
            <Sparkline values={memHistory} color="var(--vscode-charts-purple, #b180d7)" />
          </div>
          <div class="stat-card">
            <div class="stat-label">Cores</div>
            <div class="stat-value">{varz.cores}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Connections</div>
            <div class="stat-value">{varz.connections} / {varz.max_connections}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Connections</div>
            <div class="stat-value">{formatCount(varz.total_connections)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Messages In</div>
            <div class="stat-value">{formatCount(varz.in_msgs)}</div>
            <Sparkline values={msgsInHistory} color="var(--vscode-charts-green, #89d185)" />
          </div>
          <div class="stat-card">
            <div class="stat-label">Messages Out</div>
            <div class="stat-value">{formatCount(varz.out_msgs)}</div>
            <Sparkline values={msgsOutHistory} color="var(--vscode-charts-blue, #3794ff)" />
          </div>
          <div class="stat-card">
            <div class="stat-label">Data In</div>
            <div class="stat-value">{formatBytes(varz.in_bytes)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Data Out</div>
            <div class="stat-value">{formatBytes(varz.out_bytes)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Subscriptions</div>
            <div class="stat-value">{formatCount(varz.subscriptions)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Slow Consumers</div>
            <div class="stat-value" class:warn={varz.slow_consumers > 0}>{varz.slow_consumers}</div>
          </div>
        </div>
      {:else if !error}
        <div class="empty">Loading server info...</div>
      {/if}
    </div>
  {:else if activeTab === "connections"}
    <div class="panel">
      {#if connz}
        <div class="table-info">
          {connz.num_connections} active connection{connz.num_connections !== 1 ? "s" : ""}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>IP</th>
                <th>Lang</th>
                <th>Version</th>
                <th>RTT</th>
                <th>Uptime</th>
                <th>Msgs In</th>
                <th>Msgs Out</th>
                <th>Data In</th>
                <th>Data Out</th>
                <th>Subs</th>
              </tr>
            </thead>
            <tbody>
              {#each connz.connections as conn}
                <tr>
                  <td class="name-cell">{conn.name || "-"}</td>
                  <td>{conn.ip}:{conn.port}</td>
                  <td>{conn.lang}</td>
                  <td>{conn.version}</td>
                  <td>{conn.rtt}</td>
                  <td>{conn.uptime}</td>
                  <td class="num">{formatCount(conn.in_msgs)}</td>
                  <td class="num">{formatCount(conn.out_msgs)}</td>
                  <td class="num">{formatBytes(conn.in_bytes)}</td>
                  <td class="num">{formatBytes(conn.out_bytes)}</td>
                  <td class="num">{conn.subscriptions}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if !error}
        <div class="empty">Loading connections...</div>
      {/if}
    </div>
  {:else if activeTab === "jetstream"}
    <div class="panel">
      {#if jsz}
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Streams</div>
            <div class="stat-value">{jsz.total_streams}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Consumers</div>
            <div class="stat-value">{jsz.total_consumers}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Memory Used</div>
            <div class="stat-value">{formatBytes(jsz.memory)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Storage Used</div>
            <div class="stat-value">{formatBytes(jsz.storage)}</div>
          </div>
          {#if jsz.config}
            <div class="stat-card">
              <div class="stat-label">Max Memory</div>
              <div class="stat-value">{formatBytes(jsz.config.max_memory)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Max Storage</div>
              <div class="stat-value">{formatBytes(jsz.config.max_store)}</div>
            </div>
          {/if}
          <div class="stat-card">
            <div class="stat-label">API Calls</div>
            <div class="stat-value">{formatCount(jsz.api.total)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">API Errors</div>
            <div class="stat-value" class:warn={jsz.api.errors > 0}>{formatCount(jsz.api.errors)}</div>
          </div>
        </div>
      {:else if !error}
        <div class="empty">Loading JetStream info...</div>
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
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
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
    padding: 12px;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .stat-card {
    background: var(
      --vscode-sideBar-background,
      var(--vscode-editor-background)
    );
    border: 1px solid var(--vscode-widget-border, transparent);
    border-radius: 4px;
    padding: 10px;
  }
  .stat-label {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 2px;
  }
  .stat-value {
    font-size: 1.2em;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .stat-value.warn {
    color: var(--vscode-charts-yellow, #cca700);
  }
  .table-info {
    font-size: 0.9em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85em;
  }
  th {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-widget-border, transparent);
    color: var(--vscode-descriptionForeground);
    font-weight: 600;
    white-space: nowrap;
  }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--vscode-widget-border, transparent);
    white-space: nowrap;
  }
  tr:hover td {
    background: var(--vscode-list-hoverBackground);
  }
  .name-cell {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .empty {
    padding: 24px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
  }
  .error-msg {
    margin: 8px 12px;
    padding: 8px;
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    border-radius: 4px;
    color: var(--vscode-errorForeground);
  }
</style>
