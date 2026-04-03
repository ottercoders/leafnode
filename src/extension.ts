import * as vscode from "vscode";
import { ConnectionManager } from "./connections/manager";
import {
  ConnectionsTreeProvider,
  ConnectionTreeItem,
} from "./views/trees/connections";
import { StreamsTreeProvider } from "./views/trees/streams";
import { KvTreeProvider } from "./views/trees/kv";
import { ObjTreeProvider } from "./views/trees/obj";
import { SubjectTreeProvider } from "./views/trees/subjects";
import { WebviewPanelManager } from "./views/webviews/webview-panel-manager";
import { WebviewMessageRouter } from "./views/webviews/message-router";
import { runConnectionWizard } from "./views/input/connection-wizard";
import { runStreamWizard } from "./views/input/stream-wizard";
import { runConsumerWizard } from "./views/input/consumer-wizard";
import {
  discoverNatsContexts,
  contextToConnectionConfig,
  readCredsFile,
  readNkeyFile,
} from "./connections/context-import";
import { BookmarksService } from "./services/bookmarks";

function showError(prefix: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`${prefix}: ${msg}`);
}
import { isNatsCliAvailable, COMMON_COMMANDS } from "./cli/nats-cli";
import {
  findWorkspaceConfig,
  loadWorkspaceConfig,
  workspaceConnectionsToConfigs,
} from "./config/workspace";

let connectionManager: ConnectionManager;

export function activate(context: vscode.ExtensionContext): void {
  connectionManager = new ConnectionManager(context.globalState, context.secrets);
  context.subscriptions.push(connectionManager);

  // Webview infrastructure
  const panelManager = new WebviewPanelManager(context.extensionUri);
  context.subscriptions.push(panelManager);

  const messageRouter = new WebviewMessageRouter(connectionManager);
  messageRouter.setBookmarksService(new BookmarksService(context.globalState));
  context.subscriptions.push(messageRouter);

  // Clear services cache on disconnect
  connectionManager.onDidChangeConnectionStatus((id) => {
    if (connectionManager.getStatus(id) === "disconnected") {
      messageRouter.clearServicesCache(id);
    }
  });

  // Tree views
  const connectionsTree = new ConnectionsTreeProvider(connectionManager);
  const streamsTree = new StreamsTreeProvider(connectionManager);
  const kvTree = new KvTreeProvider(connectionManager);
  const objTree = new ObjTreeProvider(connectionManager);
  const subjectsTree = new SubjectTreeProvider(connectionManager);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("leafnode.connections", connectionsTree),
    vscode.window.registerTreeDataProvider("leafnode.streams", streamsTree),
    vscode.window.registerTreeDataProvider("leafnode.kv", kvTree),
    vscode.window.registerTreeDataProvider("leafnode.obj", objTree),
    vscode.window.registerTreeDataProvider("leafnode.subjects", subjectsTree),
  );

  // Auto-refresh
  let refreshInterval: ReturnType<typeof setInterval> | undefined;

  function setupAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    const seconds = vscode.workspace
      .getConfiguration("leafnode")
      .get<number>("autoRefreshInterval", 30);
    if (seconds > 0) {
      refreshInterval = setInterval(() => {
        if (connectionManager.getConnectedIds().length > 0) {
          streamsTree.refresh();
          kvTree.refresh();
          objTree.refresh();
          subjectsTree.refresh();
        }
      }, seconds * 1000);
    }
  }

  setupAutoRefresh();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("leafnode.autoRefreshInterval")) {
        setupAutoRefresh();
      }
    }),
    { dispose: () => { if (refreshInterval) clearInterval(refreshInterval); } },
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  statusBar.command = "leafnode.connect";
  statusBar.text = "$(plug) NATS";
  statusBar.tooltip = "NATS Connection";
  statusBar.show();
  context.subscriptions.push(statusBar);

  function updateStatusBar() {
    const connected = connectionManager.getConnectedIds();
    if (connected.length > 0) {
      const configs = connectionManager.getSavedConnections();
      const names = connected
        .map((id) => configs.find((c) => c.id === id)?.name ?? id)
        .join(", ");
      statusBar.text = `$(pass-filled) ${names}`;
      statusBar.tooltip = `Connected: ${names}\nClick to manage connections`;
    } else {
      statusBar.text = "$(plug) NATS";
      statusBar.tooltip = "NATS — Click to connect";
    }
  }

  connectionManager.onDidChangeConnectionStatus(updateStatusBar);
  connectionManager.onDidChangeConnections(updateStatusBar);

  // Helper: get first connected connection ID
  function getActiveConnectionId(): string | undefined {
    const ids = connectionManager.getConnectedIds();
    return ids[0];
  }

  // Commands
  context.subscriptions.push(
    // Connection commands
    vscode.commands.registerCommand("leafnode.addConnection", () =>
      runConnectionWizard(connectionManager),
    ),

    vscode.commands.registerCommand("leafnode.editConnection", async (item?: ConnectionTreeItem) => {
      if (!item) return;
      await runConnectionWizard(connectionManager, item.config);
    }),

    vscode.commands.registerCommand("leafnode.connect", async (item?: ConnectionTreeItem) => {
      let id: string;
      if (item) {
        id = item.config.id;
      } else {
        const configs = connectionManager.getSavedConnections();
        if (configs.length === 0) {
          const result = await runConnectionWizard(connectionManager);
          if (!result) return;
          id = result.id;
        } else {
          const pick = await vscode.window.showQuickPick(
            configs.map((c) => ({ label: c.name, description: c.servers[0], id: c.id })),
            { placeHolder: "Select connection" },
          );
          if (!pick) return;
          id = pick.id;
        }
      }
      try {
        await connectionManager.connect(id);
      } catch (err) {
        showError("Failed to connect", err);
      }
    }),

    vscode.commands.registerCommand("leafnode.disconnect", async (item?: ConnectionTreeItem) => {
      let id: string;
      if (item) {
        id = item.config.id;
      } else {
        const connected = connectionManager.getConnectedIds();
        if (connected.length === 0) return;
        const configs = connectionManager.getSavedConnections();
        const pick = await vscode.window.showQuickPick(
          configs
            .filter((c) => connected.includes(c.id))
            .map((c) => ({ label: c.name, id: c.id })),
          { placeHolder: "Select connection to disconnect" },
        );
        if (!pick) return;
        id = pick.id;
      }
      await connectionManager.disconnect(id);
    }),

    vscode.commands.registerCommand("leafnode.removeConnection", async (item?: ConnectionTreeItem) => {
      if (!item) return;
      const confirm = await vscode.window.showWarningMessage(
        `Remove connection "${item.config.name}"?`,
        { modal: true },
        "Remove",
      );
      if (confirm !== "Remove") return;
      await connectionManager.removeConnection(item.config.id);
    }),

    vscode.commands.registerCommand("leafnode.importNatsContext", async () => {
      const contexts = await discoverNatsContexts();
      if (contexts.length === 0) {
        vscode.window.showInformationMessage("No NATS CLI contexts found.");
        return;
      }

      const picks = await vscode.window.showQuickPick(
        contexts.map((c) => ({
          label: c.name,
          description: c.context.url ?? "",
          picked: true,
          context: c,
        })),
        { canPickMany: true, placeHolder: "Select contexts to import" },
      );
      if (!picks || picks.length === 0) return;

      let imported = 0;
      for (const pick of picks) {
        const { config, secrets } = contextToConnectionConfig(
          pick.context.name,
          pick.context.context,
        );

        if (secrets.token) {
          await connectionManager.storeSecret(config.id, "token", secrets.token);
        }
        if (secrets.password) {
          await connectionManager.storeSecret(config.id, "password", secrets.password);
        }
        if (secrets.credsPath) {
          const creds = await readCredsFile(secrets.credsPath);
          if (creds) await connectionManager.storeSecret(config.id, "creds", creds);
        }
        if (secrets.nkeyPath) {
          const seed = await readNkeyFile(secrets.nkeyPath);
          if (seed) await connectionManager.storeSecret(config.id, "nkeySeed", seed);
        }

        await connectionManager.addConnection(config);
        imported++;
      }

      vscode.window.showInformationMessage(
        `Imported ${imported} NATS context${imported !== 1 ? "s" : ""}.`,
      );
    }),

    // Stream commands
    vscode.commands.registerCommand("leafnode.streams.refresh", () => {
      streamsTree.refresh();
    }),

    vscode.commands.registerCommand("leafnode.streams.browseMessages",
      (item: { connectionId: string; stream: { name: string } }) => {
        const panelId = `messages:${item.connectionId}:${item.stream.name}`;
        const panel = panelManager.createOrShow(
          panelId,
          `Messages: ${item.stream.name}`,
          "message-browser",
          vscode.ViewColumn.One,
        );
        messageRouter.registerPanel(panel, panelId);
        panel.webview.postMessage({
          type: "init",
          connectionId: item.connectionId,
          streamName: item.stream.name,
        });
      },
    ),

    vscode.commands.registerCommand("leafnode.streams.purge",
      async (item: { connectionId: string; stream: { name: string } }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Purge all messages from stream "${item.stream.name}"?`,
          { modal: true },
          "Purge",
        );
        if (confirm !== "Purge") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.purgeStream(item.stream.name);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Purged stream "${item.stream.name}".`);
        } catch (err) {
          showError("Failed to purge", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.streams.delete",
      async (item: { connectionId: string; stream: { name: string } }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete stream "${item.stream.name}"? This cannot be undone.`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.deleteStream(item.stream.name);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Deleted stream "${item.stream.name}".`);
        } catch (err) {
          showError("Failed to delete", err);
        }
      },
    ),

    // Stream CRUD commands
    vscode.commands.registerCommand("leafnode.streams.create", async () => {
      const connId = getActiveConnectionId();
      if (!connId) {
        vscode.window.showWarningMessage("Connect to a NATS server first.");
        return;
      }
      const config = await runStreamWizard();
      if (!config) return;
      const { createServices } = await import("./services");
      const nc = connectionManager.getConnection(connId);
      if (!nc) return;
      try {
        await createServices(nc).jetstream.createStream(config);
        streamsTree.refresh();
        vscode.window.showInformationMessage(`Created stream "${config.name}".`);
      } catch (err) {
        showError("Failed to create stream", err);
      }
    }),

    vscode.commands.registerCommand("leafnode.streams.edit",
      async (item: { connectionId: string; stream: { name: string; config: { subjects: string[]; storage: string; retention: string; replicas: number } } }) => {
        const existing = {
          name: item.stream.name,
          subjects: item.stream.config.subjects,
          storage: item.stream.config.storage,
          retention: item.stream.config.retention,
          replicas: item.stream.config.replicas,
        };
        const config = await runStreamWizard(existing);
        if (!config) return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.updateStream(item.stream.name, {
            subjects: config.subjects,
          });
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Updated stream "${item.stream.name}".`);
        } catch (err) {
          showError("Failed to update stream", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.streams.duplicate",
      async (item: { connectionId: string; stream: { name: string; config: { subjects: string[]; storage: string; retention: string; replicas: number } } }) => {
        const prefilled = {
          name: "",
          subjects: item.stream.config.subjects,
          storage: item.stream.config.storage,
          retention: item.stream.config.retention,
          replicas: item.stream.config.replicas,
        };
        const config = await runStreamWizard(prefilled);
        if (!config) return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.createStream(config);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Created stream "${config.name}".`);
        } catch (err) {
          showError("Failed to create stream", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.streams.seal",
      async (item: { connectionId: string; stream: { name: string } }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Seal stream "${item.stream.name}"? Sealed streams cannot be unsealed.`,
          { modal: true },
          "Seal",
        );
        if (confirm !== "Seal") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.sealStream(item.stream.name);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Sealed stream "${item.stream.name}".`);
        } catch (err) {
          showError("Failed to seal stream", err);
        }
      },
    ),

    // Consumer CRUD commands
    vscode.commands.registerCommand("leafnode.consumers.create",
      async (item: { connectionId: string; stream: { name: string } }) => {
        const streamName = item.stream.name;
        const result = await runConsumerWizard(streamName);
        if (!result) return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.createConsumer(streamName, {
            durable_name: result.name,
            filter_subject: result.filterSubject,
            ack_policy: result.ackPolicy as "explicit" | "none" | "all",
            deliver_policy: result.deliverPolicy as "all" | "last" | "new" | "last_per_subject",
          });
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Created consumer "${result.name}" on stream "${streamName}".`);
        } catch (err) {
          showError("Failed to create consumer", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.consumers.delete",
      async (item: { connectionId: string; consumer: { stream: string; name: string } }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete consumer "${item.consumer.name}" from stream "${item.consumer.stream}"?`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.deleteConsumer(item.consumer.stream, item.consumer.name);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Deleted consumer "${item.consumer.name}".`);
        } catch (err) {
          showError("Failed to delete consumer", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.consumers.pause",
      async (item: { connectionId: string; consumer: { stream: string; name: string } }) => {
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.pauseConsumer(item.consumer.stream, item.consumer.name);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Paused consumer "${item.consumer.name}".`);
        } catch (err) {
          showError("Failed to pause consumer", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.consumers.resume",
      async (item: { connectionId: string; consumer: { stream: string; name: string } }) => {
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).jetstream.resumeConsumer(item.consumer.stream, item.consumer.name);
          streamsTree.refresh();
          vscode.window.showInformationMessage(`Resumed consumer "${item.consumer.name}".`);
        } catch (err) {
          showError("Failed to resume consumer", err);
        }
      },
    ),

    // Pub/Sub command
    vscode.commands.registerCommand("leafnode.openPubSub", () => {
      const connId = getActiveConnectionId();
      if (!connId) {
        vscode.window.showWarningMessage("Connect to a NATS server first.");
        return;
      }
      const panelId = `pubsub:${connId}`;
      const panel = panelManager.createOrShow(
        panelId,
        "NATS Pub/Sub",
        "pub-sub",
        vscode.ViewColumn.One,
      );
      messageRouter.registerPanel(panel, panelId);
      panel.webview.postMessage({
        type: "init",
        connectionId: connId,
      });
    }),

    // KV commands
    vscode.commands.registerCommand("leafnode.kv.refresh", () => {
      kvTree.refresh();
    }),

    vscode.commands.registerCommand("leafnode.kv.viewEntry",
      (item: { connectionId: string; bucket: string; key: string }) => {
        const panelId = `kv:${item.connectionId}:${item.bucket}:${item.key}`;
        const panel = panelManager.createOrShow(
          panelId,
          `KV: ${item.bucket}/${item.key}`,
          "kv-editor",
          vscode.ViewColumn.One,
        );
        messageRouter.registerPanel(panel, panelId);
        panel.webview.postMessage({
          type: "init",
          connectionId: item.connectionId,
          bucket: item.bucket,
          key: item.key,
        });
      },
    ),

    vscode.commands.registerCommand("leafnode.kv.deleteKey",
      async (item: { connectionId: string; bucket: string; key: string }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete key "${item.key}" from bucket "${item.bucket}"?`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).kv.delete(item.bucket, item.key);
          kvTree.refresh();
        } catch (err) {
          showError("Failed to delete key", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.kv.createBucket", async () => {
      const connId = getActiveConnectionId();
      if (!connId) {
        vscode.window.showWarningMessage("Connect to a NATS server first.");
        return;
      }
      const name = await vscode.window.showInputBox({
        prompt: "Bucket name",
        placeHolder: "my-bucket",
      });
      if (!name) return;
      const { createServices } = await import("./services");
      const nc = connectionManager.getConnection(connId);
      if (!nc) return;
      try {
        await createServices(nc).kv.createBucket(name);
        kvTree.refresh();
        vscode.window.showInformationMessage(`Created KV bucket "${name}".`);
      } catch (err) {
        showError("Failed to create bucket", err);
      }
    }),

    vscode.commands.registerCommand("leafnode.kv.deleteBucket",
      async (item: { connectionId: string; bucket: string }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete bucket "${item.bucket}"? This cannot be undone.`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).kv.deleteBucket(item.bucket);
          kvTree.refresh();
          vscode.window.showInformationMessage(`Deleted bucket "${item.bucket}".`);
        } catch (err) {
          showError("Failed to delete bucket", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.kv.purgeKey",
      async (item: { connectionId: string; bucket: string; key: string }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Purge key "${item.key}" and all its history from "${item.bucket}"?`,
          { modal: true },
          "Purge",
        );
        if (confirm !== "Purge") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).kv.purge(item.bucket, item.key);
          kvTree.refresh();
        } catch (err) {
          showError("Failed to purge key", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.kv.createKey",
      async (item?: { connectionId: string; bucket: string }) => {
        const connId = item?.connectionId ?? getActiveConnectionId();
        const bucketName = item?.bucket;
        if (!connId) {
          vscode.window.showWarningMessage("Connect to a NATS server first.");
          return;
        }

        let targetBucket = bucketName;
        if (!targetBucket) {
          targetBucket = await vscode.window.showInputBox({
            prompt: "Bucket name",
            placeHolder: "my-bucket",
          });
          if (!targetBucket) return;
        }

        const key = await vscode.window.showInputBox({
          prompt: "Key name",
          placeHolder: "my-key",
        });
        if (!key) return;

        const value = await vscode.window.showInputBox({
          prompt: "Value",
          placeHolder: "value",
        });
        if (value === undefined) return;

        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(connId);
        if (!nc) return;
        try {
          await createServices(nc).kv.put(
            targetBucket,
            key,
            new TextEncoder().encode(value),
          );
          kvTree.refresh();
        } catch (err) {
          showError("Failed to create key", err);
        }
      },
    ),

    vscode.commands.registerCommand("leafnode.kv.keyHistory",
      (item: { connectionId: string; bucket: string; key: string }) => {
        const panelId = `kv:${item.connectionId}:${item.bucket}:${item.key}`;
        const panel = panelManager.createOrShow(
          panelId,
          `KV: ${item.bucket}/${item.key}`,
          "kv-editor",
          vscode.ViewColumn.One,
        );
        messageRouter.registerPanel(panel, panelId);
        panel.webview.postMessage({
          type: "init",
          connectionId: item.connectionId,
          bucket: item.bucket,
          key: item.key,
          showHistory: true,
        });
      },
    ),

    vscode.commands.registerCommand("leafnode.kv.loadMore",
      (_item: { connectionId: string; bucket: string; offset: number }) => {
        kvTree.refresh();
      },
    ),

    // Object Store commands
    vscode.commands.registerCommand("leafnode.obj.refresh", () => {
      objTree.refresh();
    }),

    vscode.commands.registerCommand("leafnode.obj.viewObject",
      (item: { connectionId: string; store: string; name: string }) => {
        const panelId = `obj:${item.connectionId}:${item.store}:${item.name}`;
        const panel = panelManager.createOrShow(
          panelId,
          `Object: ${item.store}/${item.name}`,
          "obj-viewer",
          vscode.ViewColumn.One,
        );
        messageRouter.registerPanel(panel, panelId);
        panel.webview.postMessage({
          type: "init",
          connectionId: item.connectionId,
          store: item.store,
          name: item.name,
        });
      },
    ),

    vscode.commands.registerCommand("leafnode.obj.deleteObject",
      async (item: { connectionId: string; store: string; name: string }) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete object "${item.name}" from store "${item.store}"?`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;
        const { createServices } = await import("./services");
        const nc = connectionManager.getConnection(item.connectionId);
        if (!nc) return;
        try {
          await createServices(nc).obj.deleteObject(item.store, item.name);
          objTree.refresh();
          vscode.window.showInformationMessage(`Deleted object "${item.name}".`);
        } catch (err) {
          showError("Failed to delete object", err);
        }
      },
    ),

    // Subject Explorer commands
    vscode.commands.registerCommand("leafnode.subjects.refresh", () => {
      subjectsTree.refresh();
    }),

    // Server Monitor command
    vscode.commands.registerCommand("leafnode.openServerMonitor", () => {
      const connId = getActiveConnectionId();
      if (!connId) {
        vscode.window.showWarningMessage("Connect to a NATS server first.");
        return;
      }
      const panelId = `monitor:${connId}`;
      const panel = panelManager.createOrShow(
        panelId,
        "Server Monitor",
        "server-monitor",
        vscode.ViewColumn.One,
      );
      messageRouter.registerPanel(panel, panelId);
      panel.webview.postMessage({
        type: "init",
        connectionId: connId,
      });
    }),

    // NATS CLI command
    vscode.commands.registerCommand("leafnode.runNatsCommand", async () => {
      const available = await isNatsCliAvailable();
      if (!available) {
        vscode.window.showErrorMessage(
          "NATS CLI not found. Install it from https://github.com/nats-io/natscli",
        );
        return;
      }

      const items = [
        ...COMMON_COMMANDS.map((c) => ({
          label: c.label,
          args: c.args,
        })),
        { label: "Custom command...", args: [] as string[] },
      ];

      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a NATS command to run",
      });
      if (!pick) return;

      let args: string[];
      if (pick.label === "Custom command...") {
        const input = await vscode.window.showInputBox({
          prompt: "Enter NATS CLI arguments",
          placeHolder: "e.g. stream ls --json",
        });
        if (!input) return;
        args = input.split(/\s+/);
      } else {
        args = pick.args;
      }

      const terminal = vscode.window.createTerminal("NATS CLI");
      terminal.show();
      terminal.sendText(`nats ${args.join(" ")}`);
    }),

    // Workspace config command
    vscode.commands.registerCommand("leafnode.workspace.init", async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) {
        vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }
      const configPath = vscode.Uri.joinPath(folders[0].uri, ".leafnode.json");
      const template = JSON.stringify(
        {
          connections: [
            {
              name: "Local NATS",
              servers: ["nats://localhost:4222"],
              monitoringUrl: "http://localhost:8222",
            },
          ],
        },
        null,
        2,
      );
      await vscode.workspace.fs.writeFile(
        configPath,
        new TextEncoder().encode(template),
      );
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
    }),
  );

  // Load workspace config on activation
  const wsConfigPath = findWorkspaceConfig();
  if (wsConfigPath) {
    const wsConfig = loadWorkspaceConfig(wsConfigPath);
    if (wsConfig) {
      const wsConnections = workspaceConnectionsToConfigs(wsConfig);
      const existingNames = new Set(
        connectionManager.getSavedConnections().map((c) => c.name),
      );
      for (const conn of wsConnections) {
        if (!existingNames.has(conn.name)) {
          connectionManager.addConnection(conn).catch(() => {
            // Silently ignore errors loading workspace connections
          });
        }
      }
    }
  }
}

export function deactivate(): void {}
