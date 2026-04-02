import * as vscode from "vscode";
import type { ConnectionManager } from "../../connections/manager";
import { createServices } from "../../services";
import { formatBytes, formatCount } from "../../utils/format";

type ObjTreeElement = ConnectionNode | StoreNode | ObjectNode;

interface ConnectionNode {
  type: "objConnection";
  id: string;
  name: string;
}

interface StoreNode {
  type: "objStore";
  connectionId: string;
  store: string;
  objects: number;
  size: number;
}

interface ObjectNode {
  type: "objObject";
  connectionId: string;
  store: string;
  name: string;
  size: number;
}

export class ObjTreeProvider
  implements vscode.TreeDataProvider<ObjTreeElement>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ObjTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly manager: ConnectionManager) {
    manager.onDidChangeConnectionStatus(() => this._onDidChangeTreeData.fire());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ObjTreeElement): vscode.TreeItem {
    switch (element.type) {
      case "objConnection": {
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon("server");
        return item;
      }

      case "objStore": {
        const item = new vscode.TreeItem(
          element.store,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.description = `${formatCount(element.objects)} objects, ${formatBytes(element.size)}`;
        item.iconPath = new vscode.ThemeIcon("package");
        item.contextValue = "objStore";
        return item;
      }

      case "objObject": {
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.None,
        );
        item.description = formatBytes(element.size);
        item.iconPath = new vscode.ThemeIcon("file-binary");
        item.contextValue = "objObject";
        item.command = {
          command: "leafnode.obj.viewObject",
          title: "View Object",
          arguments: [element],
        };
        return item;
      }
    }
  }

  async getChildren(element?: ObjTreeElement): Promise<ObjTreeElement[]> {
    if (!element) {
      const connectedIds = this.manager.getConnectedIds();
      if (connectedIds.length === 0) return [];

      if (connectedIds.length === 1) {
        return this.getStoresForConnection(connectedIds[0]);
      }

      const configs = this.manager.getSavedConnections();
      return connectedIds.map((id) => ({
        type: "objConnection" as const,
        id,
        name: configs.find((c) => c.id === id)?.name ?? id,
      }));
    }

    switch (element.type) {
      case "objConnection":
        return this.getStoresForConnection(element.id);

      case "objStore":
        return this.getObjectsForStore(element.connectionId, element.store);

      default:
        return [];
    }
  }

  private async getStoresForConnection(
    connectionId: string,
  ): Promise<ObjTreeElement[]> {
    const nc = this.manager.getConnection(connectionId);
    if (!nc) return [];

    const services = createServices(nc);
    try {
      const stores = await services.obj.listStores();
      return stores.map((s) => ({
        type: "objStore" as const,
        connectionId,
        store: s.name,
        objects: s.objects,
        size: s.size,
      }));
    } catch {
      return [];
    }
  }

  private async getObjectsForStore(
    connectionId: string,
    store: string,
  ): Promise<ObjTreeElement[]> {
    const nc = this.manager.getConnection(connectionId);
    if (!nc) return [];

    const services = createServices(nc);
    try {
      const objects = await services.obj.listObjects(store);
      return objects.map((o) => ({
        type: "objObject" as const,
        connectionId,
        store,
        name: o.name,
        size: o.size,
      }));
    } catch {
      return [];
    }
  }
}
