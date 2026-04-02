import * as vscode from "vscode";
import type { ConnectionManager } from "../../connections/manager";
import { createServices } from "../../services";
import { formatBytes, formatCount } from "../../utils/format";

type KvTreeElement = ConnectionNode | BucketNode | KeyNode | LoadMoreNode;

interface ConnectionNode {
  type: "kvConnection";
  id: string;
  name: string;
}

interface BucketNode {
  type: "kvBucket";
  connectionId: string;
  bucket: string;
  values: number;
  bytes: number;
}

interface KeyNode {
  type: "kvKey";
  connectionId: string;
  bucket: string;
  key: string;
}

interface LoadMoreNode {
  type: "loadMore";
  connectionId: string;
  bucket: string;
  offset: number;
}

const PAGE_SIZE = 100;

export class KvTreeProvider
  implements vscode.TreeDataProvider<KvTreeElement>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<KvTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private keyCache = new Map<string, string[]>();

  constructor(private readonly manager: ConnectionManager) {
    manager.onDidChangeConnectionStatus(() => this._onDidChangeTreeData.fire());
  }

  refresh(): void {
    this.keyCache.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KvTreeElement): vscode.TreeItem {
    switch (element.type) {
      case "kvConnection": {
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon("server");
        return item;
      }

      case "kvBucket": {
        const item = new vscode.TreeItem(
          element.bucket,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.description = `${formatCount(element.values)} keys, ${formatBytes(element.bytes)}`;
        item.iconPath = new vscode.ThemeIcon("archive");
        item.contextValue = "kvBucket";
        return item;
      }

      case "kvKey": {
        const item = new vscode.TreeItem(
          element.key,
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = new vscode.ThemeIcon("key");
        item.contextValue = "kvKey";
        item.command = {
          command: "leafnode.kv.viewEntry",
          title: "View Entry",
          arguments: [element],
        };
        return item;
      }

      case "loadMore": {
        const item = new vscode.TreeItem(
          "Load More...",
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = new vscode.ThemeIcon("ellipsis");
        item.command = {
          command: "leafnode.kv.loadMore",
          title: "Load More",
          arguments: [element],
        };
        return item;
      }
    }
  }

  async getChildren(element?: KvTreeElement): Promise<KvTreeElement[]> {
    if (!element) {
      const connectedIds = this.manager.getConnectedIds();
      if (connectedIds.length === 0) return [];

      if (connectedIds.length === 1) {
        return this.getBucketsForConnection(connectedIds[0]);
      }

      const configs = this.manager.getSavedConnections();
      return connectedIds.map((id) => ({
        type: "kvConnection" as const,
        id,
        name: configs.find((c) => c.id === id)?.name ?? id,
      }));
    }

    switch (element.type) {
      case "kvConnection":
        return this.getBucketsForConnection(element.id);

      case "kvBucket": {
        return this.getKeysForBucket(
          element.connectionId,
          element.bucket,
          0,
        );
      }

      default:
        return [];
    }
  }

  private async getBucketsForConnection(
    connectionId: string,
  ): Promise<KvTreeElement[]> {
    const nc = this.manager.getConnection(connectionId);
    if (!nc) return [];

    const services = createServices(nc);
    try {
      const buckets = await services.kv.listBuckets();
      return buckets.map((b) => ({
        type: "kvBucket" as const,
        connectionId,
        bucket: b.bucket,
        values: b.values,
        bytes: b.bytes,
      }));
    } catch {
      return [];
    }
  }

  private async getKeysForBucket(
    connectionId: string,
    bucket: string,
    offset: number,
  ): Promise<KvTreeElement[]> {
    const cacheKey = `${connectionId}:${bucket}`;
    let allKeys = this.keyCache.get(cacheKey);

    if (!allKeys) {
      const nc = this.manager.getConnection(connectionId);
      if (!nc) return [];
      const services = createServices(nc);
      try {
        allKeys = await services.kv.getKeys(bucket);
        this.keyCache.set(cacheKey, allKeys);
      } catch {
        return [];
      }
    }

    const page = allKeys.slice(offset, offset + PAGE_SIZE);
    const items: KvTreeElement[] = page.map((key) => ({
      type: "kvKey" as const,
      connectionId,
      bucket,
      key,
    }));

    if (offset + PAGE_SIZE < allKeys.length) {
      items.push({
        type: "loadMore",
        connectionId,
        bucket,
        offset: offset + PAGE_SIZE,
      });
    }

    return items;
  }
}
