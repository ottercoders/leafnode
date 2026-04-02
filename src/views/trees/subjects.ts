import * as vscode from "vscode";
import type { ConnectionManager } from "../../connections/manager";
import { createServices } from "../../services";

interface SubjectToken {
  token: string;
  children: Map<string, SubjectToken>;
  streamName?: string;
}

type SubjectTreeElement = SubjectNode;

interface SubjectNode {
  type: "subjectNode";
  token: string;
  fullPath: string;
  hasChildren: boolean;
  streamName?: string;
  connectionId: string;
}

export class SubjectTreeProvider
  implements vscode.TreeDataProvider<SubjectTreeElement>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<SubjectTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private trieCache = new Map<string, SubjectToken>();

  constructor(private readonly manager: ConnectionManager) {
    manager.onDidChangeConnectionStatus(() => {
      this.trieCache.clear();
      this._onDidChangeTreeData.fire();
    });
  }

  refresh(): void {
    this.trieCache.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SubjectTreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.token,
      element.hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    if (element.streamName) {
      item.description = element.streamName;
    }
    item.iconPath = new vscode.ThemeIcon(
      element.hasChildren ? "symbol-namespace" : "symbol-string",
    );
    item.contextValue = "subject";
    item.tooltip = element.fullPath;
    return item;
  }

  async getChildren(element?: SubjectTreeElement): Promise<SubjectTreeElement[]> {
    const connectedIds = this.manager.getConnectedIds();
    if (connectedIds.length === 0) return [];

    const connectionId = connectedIds[0];
    let root = this.trieCache.get(connectionId);
    if (!root) {
      root = await this.buildTrie(connectionId);
      if (root) this.trieCache.set(connectionId, root);
      else return [];
    }

    if (!element) {
      return Array.from(root.children.entries()).map(([token, node]) => ({
        type: "subjectNode" as const,
        token,
        fullPath: token,
        hasChildren: node.children.size > 0,
        streamName: node.streamName,
        connectionId,
      }));
    }

    const node = this.findNode(root, element.fullPath);
    if (!node) return [];

    return Array.from(node.children.entries()).map(([token, child]) => ({
      type: "subjectNode" as const,
      token,
      fullPath: `${element.fullPath}.${token}`,
      hasChildren: child.children.size > 0,
      streamName: child.streamName,
      connectionId: element.connectionId,
    }));
  }

  private async buildTrie(connectionId: string): Promise<SubjectToken | undefined> {
    const nc = this.manager.getConnection(connectionId);
    if (!nc) return undefined;

    const services = createServices(nc);
    try {
      const streams = await services.jetstream.listStreams();
      const root: SubjectToken = { token: "", children: new Map() };

      for (const stream of streams) {
        for (const subject of stream.config.subjects) {
          const tokens = subject.split(".");
          let current = root;
          for (const token of tokens) {
            if (!current.children.has(token)) {
              current.children.set(token, { token, children: new Map() });
            }
            current = current.children.get(token)!;
          }
          current.streamName = stream.name;
        }
      }
      return root;
    } catch {
      return undefined;
    }
  }

  private findNode(root: SubjectToken, path: string): SubjectToken | undefined {
    const tokens = path.split(".");
    let current = root;
    for (const token of tokens) {
      const child = current.children.get(token);
      if (!child) return undefined;
      current = child;
    }
    return current;
  }
}
