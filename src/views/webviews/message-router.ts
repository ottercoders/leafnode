import * as vscode from "vscode";
import type { ConnectionManager } from "../../connections/manager";
import type { Services } from "../../services";
import { createServices } from "../../services";
import type { ExtensionMessage } from "../../types/messages";
import type { ActiveSubscription } from "../../services/nats";
import type { BookmarksService } from "../../services/bookmarks";
import { MonitoringService } from "../../services/monitoring";
import * as fs from "fs";

interface Cancelable {
  cancel(): void;
}

export class WebviewMessageRouter implements vscode.Disposable {
  private servicesCache = new Map<string, Services>();
  private subscriptions = new Map<string, ActiveSubscription>();
  private watches = new Map<string, Cancelable>();
  private panelSubscriptions = new Map<string, Set<string>>();
  private panelDisposables = new Map<string, vscode.Disposable[]>();
  private bookmarksService?: BookmarksService;

  constructor(private readonly connectionManager: ConnectionManager) {}

  setBookmarksService(svc: BookmarksService): void {
    this.bookmarksService = svc;
  }

  private getServices(connectionId: string): Services | undefined {
    let services = this.servicesCache.get(connectionId);
    if (services) return services;

    const nc = this.connectionManager.getConnection(connectionId);
    if (!nc) return undefined;

    services = createServices(nc);
    this.servicesCache.set(connectionId, services);
    return services;
  }

  registerPanel(panel: vscode.WebviewPanel, panelId: string): void {
    // Clean up previous registrations for this panel
    this.disposePanelDisposables(panelId);

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      panel.webview.onDidReceiveMessage(
        (message: ExtensionMessage) => {
          this.handleMessage(message, panel, panelId).catch((err) => {
            panel.webview.postMessage({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            });
          });
        },
      ),
    );

    disposables.push(
      panel.onDidDispose(() => {
        this.cleanupPanelSubscriptions(panelId);
        this.disposePanelDisposables(panelId);
      }),
    );

    this.panelDisposables.set(panelId, disposables);
  }

  private disposePanelDisposables(panelId: string): void {
    const disposables = this.panelDisposables.get(panelId);
    if (disposables) {
      for (const d of disposables) d.dispose();
      this.panelDisposables.delete(panelId);
    }
  }

  private async handleMessage(
    message: ExtensionMessage,
    panel: vscode.WebviewPanel,
    panelId: string,
  ): Promise<void> {
    switch (message.type) {
      case "streams:list": {
        const svc = this.requireServices(message.connectionId);
        const streams = await svc.jetstream.listStreams();
        panel.webview.postMessage({ type: "streams:data", streams });
        break;
      }

      case "stream:messages": {
        const svc = this.requireServices(message.connectionId);
        const messages = await svc.jetstream.getStreamMessages(
          message.stream,
          message.opts,
        );
        panel.webview.postMessage({
          type: "stream:messages:data",
          messages,
        });
        break;
      }

      case "stream:search": {
        const svc = this.requireServices(message.connectionId);
        const messages = await svc.jetstream.searchMessages(
          message.stream,
          message.pattern,
          message.limit,
        );
        panel.webview.postMessage({
          type: "stream:search:data",
          messages,
        });
        break;
      }

      case "publish": {
        const svc = this.requireServices(message.connectionId);
        const payload = new TextEncoder().encode(message.payload);
        await svc.nats.publish(message.subject, payload, {
          headers: message.headers,
        });
        break;
      }

      case "subscribe": {
        const svc = this.requireServices(message.connectionId);
        const sub = svc.nats.subscribe(message.subject);
        this.subscriptions.set(message.id, sub);

        // Track subscription to panel for cleanup
        let panelSubs = this.panelSubscriptions.get(panelId);
        if (!panelSubs) {
          panelSubs = new Set();
          this.panelSubscriptions.set(panelId, panelSubs);
        }
        panelSubs.add(message.id);

        // Forward messages to webview
        (async () => {
          for await (const msg of sub.messages) {
            if (!this.subscriptions.has(message.id)) break;
            panel.webview.postMessage({
              type: "subscription:message",
              id: message.id,
              message: msg,
            });
          }
        })().catch(() => {
          // Subscription ended
          this.subscriptions.delete(message.id);
        });
        break;
      }

      case "unsubscribe": {
        const sub = this.subscriptions.get(message.id);
        if (sub) {
          sub.unsubscribe();
          this.subscriptions.delete(message.id);
          // Remove from panel tracking
          for (const panelSubs of this.panelSubscriptions.values()) {
            panelSubs.delete(message.id);
          }
        }
        break;
      }

      case "request": {
        const svc = this.requireServices(message.connectionId);
        const payload = new TextEncoder().encode(message.payload);
        const start = Date.now();
        try {
          const response = await svc.nats.request(
            message.subject,
            payload,
            {
              timeout: message.timeout,
              headers: message.headers,
            },
          );
          panel.webview.postMessage({
            type: "request:response",
            message: response,
            durationMs: Date.now() - start,
          });
        } catch (err) {
          panel.webview.postMessage({
            type: "request:error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      case "kv:buckets": {
        const svc = this.requireServices(message.connectionId);
        const buckets = await svc.kv.listBuckets();
        panel.webview.postMessage({ type: "kv:buckets:data", buckets });
        break;
      }

      case "kv:keys": {
        const svc = this.requireServices(message.connectionId);
        const keys = await svc.kv.getKeys(message.bucket);
        panel.webview.postMessage({ type: "kv:keys:data", keys });
        break;
      }

      case "kv:get": {
        const svc = this.requireServices(message.connectionId);
        const entry = await svc.kv.get(message.bucket, message.key);
        if (entry) {
          panel.webview.postMessage({ type: "kv:entry", entry });
        }
        break;
      }

      case "kv:put": {
        const svc = this.requireServices(message.connectionId);
        const value = new TextEncoder().encode(message.value);
        await svc.kv.put(message.bucket, message.key, value);
        // Re-fetch and send back
        const entry = await svc.kv.get(message.bucket, message.key);
        if (entry) {
          panel.webview.postMessage({ type: "kv:entry", entry });
        }
        break;
      }

      case "kv:delete": {
        const svc = this.requireServices(message.connectionId);
        await svc.kv.delete(message.bucket, message.key);
        break;
      }

      case "kv:history": {
        const svc = this.requireServices(message.connectionId);
        const entries = await svc.kv.history(message.bucket, message.key);
        panel.webview.postMessage({ type: "kv:history:data", entries });
        break;
      }

      case "kv:watch": {
        const svc = this.requireServices(message.connectionId);
        let cancelled = false;
        const watch = {
          cancel: () => { cancelled = true; },
        };
        this.watches.set(message.id, watch);

        let panelSubs = this.panelSubscriptions.get(panelId);
        if (!panelSubs) {
          panelSubs = new Set();
          this.panelSubscriptions.set(panelId, panelSubs);
        }
        panelSubs.add(message.id);

        (async () => {
          for await (const entry of await svc.kv.watchEntries(
            message.bucket,
            message.key,
          )) {
            if (cancelled) break;
            panel.webview.postMessage({
              type: "kv:watch:update",
              id: message.id,
              entry,
            });
            vscode.window.showInformationMessage(
              `KV key "${entry.key}" updated (${entry.operation}, rev ${entry.revision})`,
              "View",
            ).then(action => {
              if (action === "View") {
                panel.reveal();
              }
            });
          }
        })().catch(() => {
          this.watches.delete(message.id);
        });
        break;
      }

      case "kv:unwatch": {
        const watch = this.watches.get(message.id);
        if (watch) {
          watch.cancel();
          this.watches.delete(message.id);
          for (const panelSubs of this.panelSubscriptions.values()) {
            panelSubs.delete(message.id);
          }
        }
        break;
      }

      case "bookmarks:list": {
        if (this.bookmarksService) {
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "bookmarks:saveSubscription": {
        if (this.bookmarksService) {
          await this.bookmarksService.saveSubscription({
            name: message.name,
            subject: message.subject,
          });
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "bookmarks:deleteSubscription": {
        if (this.bookmarksService) {
          await this.bookmarksService.deleteSubscription(message.name);
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "bookmarks:saveTemplate": {
        if (this.bookmarksService) {
          await this.bookmarksService.saveTemplate(message.template);
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "bookmarks:deleteTemplate": {
        if (this.bookmarksService) {
          await this.bookmarksService.deleteTemplate(message.name);
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "bookmarks:saveMessage": {
        if (this.bookmarksService) {
          await this.bookmarksService.saveMessageBookmark(message.bookmark);
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "bookmarks:deleteMessage": {
        if (this.bookmarksService) {
          await this.bookmarksService.deleteMessageBookmark(message.name);
          panel.webview.postMessage({
            type: "bookmarks:data",
            subscriptions: this.bookmarksService.getSavedSubscriptions(),
            templates: this.bookmarksService.getSavedTemplates(),
            bookmarks: this.bookmarksService.getMessageBookmarks(),
          });
        }
        break;
      }

      case "obj:stores": {
        const svc = this.requireServices(message.connectionId);
        const stores = await svc.obj.listStores();
        panel.webview.postMessage({ type: "obj:stores:data", stores });
        break;
      }

      case "obj:objects": {
        const svc = this.requireServices(message.connectionId);
        const objects = await svc.obj.listObjects(message.store);
        panel.webview.postMessage({ type: "obj:objects:data", objects });
        break;
      }

      case "obj:info": {
        const svc = this.requireServices(message.connectionId);
        const info = await svc.obj.getObjectInfo(message.store, message.name);
        if (info) {
          panel.webview.postMessage({ type: "obj:info:data", info });
        }
        break;
      }

      case "obj:delete": {
        const svc = this.requireServices(message.connectionId);
        await svc.obj.deleteObject(message.store, message.name);
        break;
      }

      case "monitor:varz": {
        const monSvc = this.getMonitoringService(message.connectionId);
        const varz = await monSvc.getVarz();
        panel.webview.postMessage({ type: "monitor:varz:data", data: varz });
        break;
      }

      case "monitor:connz": {
        const monSvc = this.getMonitoringService(message.connectionId);
        const connz = await monSvc.getConnz({ limit: 256 });
        panel.webview.postMessage({ type: "monitor:connz:data", data: connz });
        break;
      }

      case "monitor:jsz": {
        const monSvc = this.getMonitoringService(message.connectionId);
        const jsz = await monSvc.getJsz();
        panel.webview.postMessage({ type: "monitor:jsz:data", data: jsz });
        break;
      }

      case "monitor:accountz": {
        const monSvc = this.getMonitoringService(message.connectionId);
        const accountz = await monSvc.getAccountz();
        panel.webview.postMessage({
          type: "monitor:accountz:data",
          data: accountz,
        });
        break;
      }

      case "message:republish": {
        const svc = this.requireServices(message.connectionId);
        const payload = new TextEncoder().encode(message.payload);
        await svc.nats.publish(message.subject, payload, { headers: message.headers });
        panel.webview.postMessage({ type: "message:republished" });
        break;
      }

      case "export:messages": {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file("messages.json"),
          filters: { "JSON": ["json"], "NDJSON": ["ndjson"] },
        });
        if (uri) {
          fs.writeFileSync(uri.fsPath, message.data, "utf-8");
          vscode.window.showInformationMessage(`Exported messages to ${uri.fsPath}`);
        }
        break;
      }
    }
  }

  private getMonitoringService(connectionId: string): MonitoringService {
    const config = this.connectionManager
      .getSavedConnections()
      .find((c) => c.id === connectionId);
    if (!config?.monitoringUrl) {
      throw new Error(
        "No monitoring URL configured for this connection. Edit the connection and set a monitoring URL (e.g. http://localhost:8222).",
      );
    }
    return new MonitoringService(config.monitoringUrl);
  }

  private requireServices(connectionId: string): Services {
    const svc = this.getServices(connectionId);
    if (!svc) {
      throw new Error(`Not connected to ${connectionId}`);
    }
    return svc;
  }

  private cleanupPanelSubscriptions(panelId: string): void {
    const panelSubs = this.panelSubscriptions.get(panelId);
    if (panelSubs) {
      for (const subId of panelSubs) {
        const sub = this.subscriptions.get(subId);
        if (sub) {
          sub.unsubscribe();
          this.subscriptions.delete(subId);
        }
        const watch = this.watches.get(subId);
        if (watch) {
          watch.cancel();
          this.watches.delete(subId);
        }
      }
      this.panelSubscriptions.delete(panelId);
    }
  }

  clearServicesCache(connectionId: string): void {
    this.servicesCache.delete(connectionId);
  }

  dispose(): void {
    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    for (const watch of this.watches.values()) {
      watch.cancel();
    }
    this.subscriptions.clear();
    this.watches.clear();
    this.panelSubscriptions.clear();
    this.servicesCache.clear();
    for (const disposables of this.panelDisposables.values()) {
      for (const d of disposables) d.dispose();
    }
    this.panelDisposables.clear();
  }
}
