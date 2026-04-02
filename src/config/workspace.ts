import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { ConnectionConfig } from "../types/connection";

export interface LeafnodeWorkspaceConfig {
  connections?: Array<{
    name: string;
    servers: string[];
    monitoringUrl?: string;
  }>;
}

export function findWorkspaceConfig(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return undefined;
  const configPath = path.join(folders[0].uri.fsPath, ".leafnode.json");
  return fs.existsSync(configPath) ? configPath : undefined;
}

export function loadWorkspaceConfig(
  filePath: string,
): LeafnodeWorkspaceConfig | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function workspaceConnectionsToConfigs(
  wc: LeafnodeWorkspaceConfig,
): ConnectionConfig[] {
  return (wc.connections ?? []).map((c, i) => ({
    id: `ws-${i}-${c.name.replace(/\s+/g, "-").toLowerCase()}`,
    name: c.name,
    servers: c.servers,
    monitoringUrl: c.monitoringUrl,
    auth: { type: "anonymous" as const },
  }));
}
