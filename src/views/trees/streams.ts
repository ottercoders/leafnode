import * as vscode from "vscode";
import type { ConnectionManager } from "../../connections/manager";
import { createServices } from "../../services";
import { formatBytes, formatCount } from "../../utils/format";
import type { StreamInfoView, ConsumerInfoView } from "../../types/nats";

type StreamTreeElement =
  | ConnectionNode
  | StreamNode
  | ConsumersGroupNode
  | ConsumerNode
  | SubjectsNode;

interface ConnectionNode {
  type: "connection";
  id: string;
  name: string;
}

interface StreamNode {
  type: "stream";
  connectionId: string;
  stream: StreamInfoView;
}

interface ConsumersGroupNode {
  type: "consumersGroup";
  connectionId: string;
  streamName: string;
}

interface ConsumerNode {
  type: "consumer";
  connectionId: string;
  consumer: ConsumerInfoView;
}

interface SubjectsNode {
  type: "subjects";
  subjects: string[];
}

export class StreamsTreeProvider
  implements vscode.TreeDataProvider<StreamTreeElement>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<StreamTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly manager: ConnectionManager) {
    manager.onDidChangeConnectionStatus(() => this._onDidChangeTreeData.fire());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StreamTreeElement): vscode.TreeItem {
    switch (element.type) {
      case "connection": {
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon("server");
        item.contextValue = "streamConnection";
        return item;
      }

      case "stream": {
        const s = element.stream;
        const item = new vscode.TreeItem(
          s.name,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.description = `${formatCount(s.state.messages)} msgs, ${formatBytes(s.state.bytes)}`;
        item.iconPath = new vscode.ThemeIcon("database");
        item.contextValue = "stream";
        item.tooltip = `${s.name}\nMessages: ${s.state.messages}\nBytes: ${formatBytes(s.state.bytes)}\nSubjects: ${s.config.subjects.join(", ")}\nStorage: ${s.config.storage}\nRetention: ${s.config.retention}\nReplicas: ${s.config.replicas}`;
        return item;
      }

      case "consumersGroup": {
        const item = new vscode.TreeItem(
          "Consumers",
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.iconPath = new vscode.ThemeIcon("symbol-enum");
        return item;
      }

      case "consumer": {
        const c = element.consumer;
        const item = new vscode.TreeItem(
          c.name,
          vscode.TreeItemCollapsibleState.None,
        );
        item.description = `lag: ${formatCount(c.numPending)}`;
        item.iconPath = new vscode.ThemeIcon("sync");
        item.contextValue = "consumer";
        item.tooltip = `${c.name}\nPending: ${c.numPending}\nAck Pending: ${c.numAckPending}\nRedelivered: ${c.numRedelivered}`;
        return item;
      }

      case "subjects": {
        const item = new vscode.TreeItem(
          `Subjects: ${element.subjects.join(", ")}`,
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = new vscode.ThemeIcon("symbol-string");
        return item;
      }
    }
  }

  async getChildren(
    element?: StreamTreeElement,
  ): Promise<StreamTreeElement[]> {
    if (!element) {
      // Root level
      const connectedIds = this.manager.getConnectedIds();
      if (connectedIds.length === 0) return [];

      if (connectedIds.length === 1) {
        // Single connection — show streams directly
        return this.getStreamsForConnection(connectedIds[0]);
      }

      // Multiple connections — show connection nodes
      const configs = this.manager.getSavedConnections();
      return connectedIds.map((id) => ({
        type: "connection" as const,
        id,
        name: configs.find((c) => c.id === id)?.name ?? id,
      }));
    }

    switch (element.type) {
      case "connection":
        return this.getStreamsForConnection(element.id);

      case "stream": {
        const children: StreamTreeElement[] = [];
        // Subjects info
        if (element.stream.config.subjects.length > 0) {
          children.push({
            type: "subjects",
            subjects: element.stream.config.subjects,
          });
        }
        // Consumers group
        if (element.stream.state.consumerCount > 0) {
          children.push({
            type: "consumersGroup",
            connectionId: element.connectionId,
            streamName: element.stream.name,
          });
        }
        return children;
      }

      case "consumersGroup": {
        const nc = this.manager.getConnection(element.connectionId);
        if (!nc) return [];
        const services = createServices(nc);
        try {
          const consumers = await services.jetstream.listConsumers(
            element.streamName,
          );
          return consumers.map((c) => ({
            type: "consumer" as const,
            connectionId: element.connectionId,
            consumer: c,
          }));
        } catch {
          return [];
        }
      }

      default:
        return [];
    }
  }

  private async getStreamsForConnection(
    connectionId: string,
  ): Promise<StreamTreeElement[]> {
    const nc = this.manager.getConnection(connectionId);
    if (!nc) return [];

    const services = createServices(nc);
    try {
      const streams = await services.jetstream.listStreams();
      return streams.map((s) => ({
        type: "stream" as const,
        connectionId,
        stream: s,
      }));
    } catch {
      return [];
    }
  }
}
