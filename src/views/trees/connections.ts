import * as vscode from "vscode";
import type { ConnectionManager } from "../../connections/manager";
import type { ConnectionConfig, ConnectionStatus } from "../../types/connection";

export class ConnectionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly config: ConnectionConfig,
    status: ConnectionStatus,
    error?: string,
  ) {
    super(config.name, vscode.TreeItemCollapsibleState.None);

    this.description = config.servers[0];
    this.contextValue = `connection:${status}`;
    this.tooltip = error
      ? `${config.name} — ${status}: ${error}`
      : `${config.name} — ${status}`;

    switch (status) {
      case "connected":
        this.iconPath = new vscode.ThemeIcon(
          "pass-filled",
          new vscode.ThemeColor("testing.iconPassed"),
        );
        break;
      case "connecting":
      case "reconnecting":
        this.iconPath = new vscode.ThemeIcon("sync~spin");
        break;
      case "error":
        this.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed"),
        );
        break;
      default:
        this.iconPath = new vscode.ThemeIcon("plug");
        break;
    }
  }
}

export class ConnectionsTreeProvider
  implements vscode.TreeDataProvider<ConnectionTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ConnectionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly manager: ConnectionManager) {
    manager.onDidChangeConnections(() => this._onDidChangeTreeData.fire());
    manager.onDidChangeConnectionStatus(() =>
      this._onDidChangeTreeData.fire(),
    );
  }

  getTreeItem(element: ConnectionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ConnectionTreeItem[] {
    return this.manager.getSavedConnections().map(
      (config) =>
        new ConnectionTreeItem(
          config,
          this.manager.getStatus(config.id),
          this.manager.getError(config.id),
        ),
    );
  }
}
