<script lang="ts">
  import { vscode } from "../../lib/vscode-api";
  import Sparkline from "../../lib/Sparkline.svelte";
  import StatusBadge from "../../lib/StatusBadge.svelte";
  import EmptyState from "../../lib/EmptyState.svelte";

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

  interface AccountzData {
    server_id: string;
    now: string;
    accounts: string[];
  }

  let connectionId = $state("");
  let activeTab = $state<"server" | "connections" | "jetstream" | "accounts">(
    "server"
  );

  let varz = $state<VarzData | null>(null);
  let connz = $state<ConnzData | null>(null);
  let jsz = $state<JszData | null>(null);
  let accountz = $state<AccountzData | null>(null);
  let error = $state("");
  let connFilter = $state("");

  // Sparkline history
  let cpuHistory = $state<number[]>([]);
  let memHistory = $state<number[]>([]);
  let msgsInHistory = $state<number[]>([]);
  let msgsOutHistory = $state<number[]>([]);

  const MAX_HISTORY = 30;

  let filteredConnections = $derived(
    connz
      ? connFilter
        ? connz.connections.filter(
            (c) =>
              (c.name || "").toLowerCase().includes(connFilter.toLowerCase()) ||
              c.ip.includes(connFilter) ||
              c.lang.toLowerCase().includes(connFilter.toLowerCase())
          )
        : connz.connections
      : []
  );

  let memoryPct = $derived(
    jsz?.config?.max_memory && jsz.config.max_memory > 0
      ? (jsz.memory / jsz.config.max_memory) * 100
      : 0
  );

  let storagePct = $derived(
    jsz?.config?.max_store && jsz.config.max_store > 0
      ? (jsz.storage / jsz.config.max_store) * 100
      : 0
  );

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
    vscode.postMessage({ type: "monitor:accountz", connectionId });
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
      } else if (msg.type === "monitor:accountz:data") {
        accountz = msg.data;
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
      onclick={() => (activeTab = "connections")}
    >
      Connections
      {#if connz}
        <span class="tab-badge">{connz.num_connections}</span>
      {/if}
    </button>
    <button
      class:active={activeTab === "jetstream"}
      onclick={() => (activeTab = "jetstream")}>JetStream</button
    >
    <button
      class:active={activeTab === "accounts"}
      onclick={() => (activeTab = "accounts")}
    >
      Accounts
      {#if accountz}
        <span class="tab-badge">{accountz.accounts.length}</span>
      {/if}
    </button>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  <!-- Server Tab -->
  {#if activeTab === "server"}
    <div class="panel">
      {#if varz}
        <!-- Hero section -->
        <div class="hero-section">
          <div class="hero-name">
            {varz.server_name || varz.server_id.slice(0, 8)}
          </div>
          <div class="hero-meta">
            <span class="badge info">v{varz.version}</span>
            <span class="hero-uptime">up {varz.uptime}</span>
            <span class="hero-detail"
              >{varz.host}:{varz.port}</span
            >
          </div>
        </div>

        <div class="stat-grid">
          <!-- CPU card with large sparkline -->
          <div class="stat-card stat-card-wide">
            <div class="stat-header">
              <span class="stat-label">CPU</span>
              <span class="stat-value">{varz.cpu.toFixed(1)}%</span>
            </div>
            <div class="sparkline-large">
              <Sparkline
                values={cpuHistory}
                color="var(--vscode-charts-yellow, #cca700)"
                fill
                showValue
              />
            </div>
          </div>

          <!-- Memory card with large sparkline -->
          <div class="stat-card stat-card-wide">
            <div class="stat-header">
              <span class="stat-label">Memory</span>
              <span class="stat-value">{formatBytes(varz.mem)}</span>
            </div>
            <div class="sparkline-large">
              <Sparkline
                values={memHistory}
                color="var(--vscode-charts-purple, #b180d7)"
                fill
                showValue
              />
            </div>
          </div>

          <!-- Messages In -->
          <div class="stat-card stat-card-wide">
            <div class="stat-header">
              <span class="stat-label">Messages In</span>
              <span class="stat-value">{formatCount(varz.in_msgs)}</span>
            </div>
            <div class="sparkline-large">
              <Sparkline
                values={msgsInHistory}
                color="var(--vscode-charts-green, #89d185)"
                fill
                showValue
              />
            </div>
          </div>

          <!-- Messages Out -->
          <div class="stat-card stat-card-wide">
            <div class="stat-header">
              <span class="stat-label">Messages Out</span>
              <span class="stat-value">{formatCount(varz.out_msgs)}</span>
            </div>
            <div class="sparkline-large">
              <Sparkline
                values={msgsOutHistory}
                color="var(--vscode-charts-blue, #3794ff)"
                fill
                showValue
              />
            </div>
          </div>

          <!-- Simple value cards -->
          <div class="stat-card">
            <div class="stat-label">Cores</div>
            <div class="stat-value">{varz.cores}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Connections</div>
            <div class="stat-value">
              {varz.connections} / {varz.max_connections}
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Total Connections</div>
            <div class="stat-value">{formatCount(varz.total_connections)}</div>
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
            <div class="stat-label">Go Runtime</div>
            <div class="stat-value stat-value-small">{varz.go}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Slow Consumers</div>
            <div class="stat-value">
              {#if varz.slow_consumers > 0}
                <StatusBadge
                  status="warning"
                  label={String(varz.slow_consumers)}
                />
              {:else}
                0
              {/if}
            </div>
          </div>
        </div>
      {:else if !error}
        <EmptyState state="loading" message="Loading server info..." />
      {/if}
    </div>

  <!-- Connections Tab -->
  {:else if activeTab === "connections"}
    <div class="panel">
      {#if connz}
        <div class="conn-toolbar">
          <input
            type="text"
            bind:value={connFilter}
            placeholder="Filter by name, IP, or language..."
            class="conn-filter"
          />
          <span class="conn-count"
            >{filteredConnections.length} of {connz.num_connections} connections</span
          >
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
                <th class="th-num">Msgs In</th>
                <th class="th-num">Msgs Out</th>
                <th class="th-num">Data In</th>
                <th class="th-num">Data Out</th>
                <th class="th-num">Subs</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredConnections as conn}
                <tr>
                  <td class="name-cell">{conn.name || "-"}</td>
                  <td class="mono">{conn.ip}:{conn.port}</td>
                  <td>{conn.lang}</td>
                  <td>{conn.version}</td>
                  <td class="mono">{conn.rtt}</td>
                  <td>{conn.uptime}</td>
                  <td class="num mono">{formatCount(conn.in_msgs)}</td>
                  <td class="num mono">{formatCount(conn.out_msgs)}</td>
                  <td class="num mono">{formatBytes(conn.in_bytes)}</td>
                  <td class="num mono">{formatBytes(conn.out_bytes)}</td>
                  <td class="num mono">{conn.subscriptions}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if !error}
        <EmptyState state="loading" message="Loading connections..." />
      {/if}
    </div>

  <!-- JetStream Tab -->
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

          <!-- Memory usage with progress bar -->
          <div class="stat-card stat-card-wide">
            <div class="stat-header">
              <span class="stat-label">Memory Used</span>
              <span class="stat-value">{formatBytes(jsz.memory)}</span>
            </div>
            {#if jsz.config && jsz.config.max_memory > 0}
              <div class="progress-row">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    class:progress-warn={memoryPct > 80}
                    style="width: {Math.min(memoryPct, 100)}%"
                  ></div>
                </div>
                <span class="progress-label"
                  >{memoryPct.toFixed(1)}% of {formatBytes(
                    jsz.config.max_memory
                  )}</span
                >
              </div>
            {/if}
          </div>

          <!-- Storage usage with progress bar -->
          <div class="stat-card stat-card-wide">
            <div class="stat-header">
              <span class="stat-label">Storage Used</span>
              <span class="stat-value">{formatBytes(jsz.storage)}</span>
            </div>
            {#if jsz.config && jsz.config.max_store > 0}
              <div class="progress-row">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    class:progress-warn={storagePct > 80}
                    style="width: {Math.min(storagePct, 100)}%"
                  ></div>
                </div>
                <span class="progress-label"
                  >{storagePct.toFixed(1)}% of {formatBytes(
                    jsz.config.max_store
                  )}</span
                >
              </div>
            {/if}
          </div>

          <div class="stat-card">
            <div class="stat-label">API Calls</div>
            <div class="stat-value">{formatCount(jsz.api.total)}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">API Errors</div>
            <div class="stat-value">
              {#if jsz.api.errors > 0}
                <StatusBadge
                  status="error"
                  label={formatCount(jsz.api.errors)}
                />
              {:else}
                0
              {/if}
            </div>
          </div>

          {#if jsz.config}
            <div class="stat-card">
              <div class="stat-label">Max Memory</div>
              <div class="stat-value">
                {formatBytes(jsz.config.max_memory)}
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Max Storage</div>
              <div class="stat-value">
                {formatBytes(jsz.config.max_store)}
              </div>
            </div>
          {/if}
        </div>
      {:else if !error}
        <EmptyState state="loading" message="Loading JetStream info..." />
      {/if}
    </div>

  <!-- Accounts Tab -->
  {:else if activeTab === "accounts"}
    <div class="panel">
      {#if accountz}
        {#if accountz.accounts.length === 0}
          <EmptyState state="empty" message="No accounts found." />
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="th-num">#</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {#each accountz.accounts as account, i}
                  <tr>
                    <td class="num mono">{i + 1}</td>
                    <td class="mono">{account}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else if !error}
        <EmptyState state="loading" message="Loading accounts..." />
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

  .panel {
    flex: 1;
    overflow: auto;
    padding: var(--space-3);
  }

  /* Hero section */
  .hero-section {
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid
      var(--vscode-panel-border, var(--vscode-widget-border, transparent));
  }

  .hero-name {
    font-size: 1.6em;
    font-weight: 700;
    margin-bottom: var(--space-1);
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .hero-uptime {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
  }

  .hero-detail {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    font-family: var(--vscode-editor-font-family);
  }

  /* Stat grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-2);
  }

  .stat-card {
    background: var(
      --vscode-sideBar-background,
      var(--vscode-editor-background)
    );
    border: 1px solid var(--vscode-widget-border, transparent);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
  }

  .stat-card-wide {
    grid-column: span 2;
  }

  .stat-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--space-1);
  }

  .stat-label {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 2px;
  }

  .stat-value {
    font-size: 1.2em;
    font-weight: 600;
    margin-bottom: var(--space-1);
  }

  .stat-value-small {
    font-size: 0.95em;
  }

  .sparkline-large {
    margin-top: var(--space-1);
  }

  .sparkline-large :global(.sparkline-wrap) {
    width: 100%;
  }

  .sparkline-large :global(.sparkline) {
    max-width: none;
    height: 36px;
  }

  /* Progress bars */
  .progress-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--vscode-progressBar-background, rgba(128, 128, 128, 0.2));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--vscode-progressBar-background, #0e70c0);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-fill.progress-warn {
    background: var(--vscode-charts-yellow, #cca700);
  }

  .progress-label {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
  }

  /* Connections toolbar */
  .conn-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .conn-filter {
    flex: 1;
    max-width: 320px;
    border-radius: var(--radius);
  }

  .conn-count {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
  }

  /* Tables */
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

  .th-num {
    text-align: right;
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

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-size: 0.75em;
    font-weight: 600;
    margin-left: 4px;
  }

  .error-msg {
    margin: var(--space-2) var(--space-3);
    padding: var(--space-2);
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    border-radius: var(--radius);
    color: var(--vscode-errorForeground);
  }
</style>
