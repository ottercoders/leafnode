import * as vscode from "vscode";
import { connect, type NatsConnection } from "@nats-io/transport-node";
import type { ConnectionConfig, ConnectionStatus } from "../types/connection";
import { buildConnectOptions } from "./auth";

const CONNECTIONS_KEY = "leafnode.connections";

interface ManagedConnection {
  config: ConnectionConfig;
  nc: NatsConnection | null;
  status: ConnectionStatus;
  error?: string;
}

export class ConnectionManager implements vscode.Disposable {
  private connections = new Map<string, ManagedConnection>();

  private readonly _onDidChangeConnections = new vscode.EventEmitter<void>();
  readonly onDidChangeConnections = this._onDidChangeConnections.event;

  private readonly _onDidChangeConnectionStatus =
    new vscode.EventEmitter<string>();
  readonly onDidChangeConnectionStatus =
    this._onDidChangeConnectionStatus.event;

  constructor(
    private readonly globalState: vscode.Memento,
    private readonly secrets: vscode.SecretStorage,
  ) {
    this.loadSavedConnections();
  }

  private loadSavedConnections(): void {
    const saved = this.globalState.get<ConnectionConfig[]>(CONNECTIONS_KEY, []);
    for (const config of saved) {
      this.connections.set(config.id, {
        config,
        nc: null,
        status: "disconnected",
      });
    }
  }

  private async persistConnections(): Promise<void> {
    const configs = Array.from(this.connections.values()).map((c) => c.config);
    await this.globalState.update(CONNECTIONS_KEY, configs);
  }

  getSavedConnections(): ConnectionConfig[] {
    return Array.from(this.connections.values()).map((c) => c.config);
  }

  getStatus(id: string): ConnectionStatus {
    return this.connections.get(id)?.status ?? "disconnected";
  }

  getError(id: string): string | undefined {
    return this.connections.get(id)?.error;
  }

  getConnection(id: string): NatsConnection | undefined {
    return this.connections.get(id)?.nc ?? undefined;
  }

  async ping(id: string): Promise<number | undefined> {
    const mc = this.connections.get(id);
    if (!mc?.nc) return undefined;
    try {
      const rtt = await mc.nc.rtt();
      return rtt;
    } catch {
      return undefined;
    }
  }

  getConnectedIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, mc]) => mc.status === "connected")
      .map(([id]) => id);
  }

  async addConnection(config: ConnectionConfig): Promise<void> {
    this.connections.set(config.id, {
      config,
      nc: null,
      status: "disconnected",
    });
    await this.persistConnections();
    this._onDidChangeConnections.fire();
  }

  async updateConnection(
    id: string,
    updates: Partial<Omit<ConnectionConfig, "id">>,
  ): Promise<void> {
    const mc = this.connections.get(id);
    if (!mc) return;
    mc.config = { ...mc.config, ...updates };
    await this.persistConnections();
    this._onDidChangeConnections.fire();
  }

  async removeConnection(id: string): Promise<void> {
    const mc = this.connections.get(id);
    if (!mc) return;
    if (mc.nc) {
      await mc.nc.drain().catch(() => {});
    }
    this.connections.delete(id);
    await this.persistConnections();
    // Clean up secrets
    await this.deleteSecretsForConnection(id);
    this._onDidChangeConnections.fire();
  }

  async connect(id: string): Promise<NatsConnection> {
    const mc = this.connections.get(id);
    if (!mc) throw new Error(`Connection ${id} not found`);
    if (mc.nc && mc.status === "connected") return mc.nc;

    this.setStatus(id, "connecting");

    try {
      const opts = await buildConnectOptions(mc.config, this.secrets);
      const nc = await connect(opts);

      mc.nc = nc;
      this.setStatus(id, "connected");

      // Listen for status changes
      (async () => {
        for await (const s of nc.status()) {
          switch (s.type) {
            case "reconnect":
              this.setStatus(id, "connected");
              break;
            case "reconnecting":
              this.setStatus(id, "reconnecting");
              break;
            case "disconnect":
              this.setStatus(id, "disconnected");
              break;
          }
        }
      })().catch(() => {});

      // Handle connection close
      nc.closed().then((err) => {
        mc.nc = null;
        if (err) {
          mc.error = err.message;
          this.setStatus(id, "error");
        } else {
          this.setStatus(id, "disconnected");
        }
      });

      return nc;
    } catch (err) {
      mc.error = err instanceof Error ? err.message : String(err);
      this.setStatus(id, "error");
      throw err;
    }
  }

  async disconnect(id: string): Promise<void> {
    const mc = this.connections.get(id);
    if (!mc?.nc) return;
    await mc.nc.drain().catch(() => {});
    mc.nc = null;
    this.setStatus(id, "disconnected");
  }

  private setStatus(id: string, status: ConnectionStatus): void {
    const mc = this.connections.get(id);
    if (!mc) return;
    mc.status = status;
    if (status !== "error") mc.error = undefined;
    this._onDidChangeConnectionStatus.fire(id);
  }

  // Secret helpers

  async storeSecret(connectionId: string, key: string, value: string): Promise<void> {
    await this.secrets.store(`leafnode.${connectionId}.${key}`, value);
  }

  async getSecret(connectionId: string, key: string): Promise<string | undefined> {
    return this.secrets.get(`leafnode.${connectionId}.${key}`);
  }

  private async deleteSecretsForConnection(id: string): Promise<void> {
    const suffixes = ["token", "password", "nkeySeed", "creds"];
    for (const suffix of suffixes) {
      try {
        await this.secrets.delete(`leafnode.${id}.${suffix}`);
      } catch {
        // Ignore — secret may not exist
      }
    }
  }

  dispose(): void {
    const drainPromises: Promise<void>[] = [];
    for (const mc of this.connections.values()) {
      if (mc.nc) {
        drainPromises.push(mc.nc.drain().catch(() => {}));
        mc.nc = null;
      }
    }
    this._onDidChangeConnections.dispose();
    this._onDidChangeConnectionStatus.dispose();
  }
}
