import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { ConnectionConfig, AuthConfig } from "../types/connection";

interface NatsCliContext {
  description?: string;
  url?: string;
  token?: string;
  user?: string;
  password?: string;
  creds?: string;
  nkey?: string;
  cert?: string;
  key?: string;
  ca?: string;
}

function generateId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getContextDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const base = xdgConfig || path.join(os.homedir(), ".config");
  return path.join(base, "nats", "context");
}

export async function discoverNatsContexts(): Promise<
  { name: string; context: NatsCliContext }[]
> {
  const contextDir = getContextDir();

  let entries: string[];
  try {
    entries = await fs.readdir(contextDir);
  } catch {
    return [];
  }

  const results: { name: string; context: NatsCliContext }[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const name = path.basename(entry, ".json");
    try {
      const raw = await fs.readFile(path.join(contextDir, entry), "utf-8");
      const context = JSON.parse(raw) as NatsCliContext;
      results.push({ name, context });
    } catch {
      // Skip invalid files
    }
  }

  return results;
}

export function contextToConnectionConfig(
  name: string,
  ctx: NatsCliContext,
): { config: ConnectionConfig; secrets: Record<string, string> } {
  const id = generateId();
  const servers = ctx.url ? [ctx.url] : ["nats://localhost:4222"];
  const secrets: Record<string, string> = {};

  let auth: AuthConfig;

  if (ctx.creds) {
    auth = { type: "credentials", credsSecret: `leafnode.${id}.creds` };
    // The creds file content will be read and stored separately
    secrets.credsPath = ctx.creds;
  } else if (ctx.nkey) {
    auth = { type: "nkey", seedSecret: `leafnode.${id}.nkeySeed` };
    secrets.nkeyPath = ctx.nkey;
  } else if (ctx.token) {
    auth = { type: "token", tokenSecret: `leafnode.${id}.token` };
    secrets.token = ctx.token;
  } else if (ctx.user && ctx.password) {
    auth = {
      type: "userpass",
      user: ctx.user,
      passSecret: `leafnode.${id}.password`,
    };
    secrets.password = ctx.password;
  } else if (ctx.cert && ctx.key) {
    auth = {
      type: "tls",
      certPath: ctx.cert,
      keyPath: ctx.key,
      caPath: ctx.ca,
    };
  } else {
    auth = { type: "anonymous" };
  }

  return {
    config: { id, name, servers, auth },
    secrets,
  };
}

export async function readCredsFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function readNkeyFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    // NKey seed files contain the seed on the first non-empty line
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && trimmed.startsWith("S")) return trimmed;
    }
    return content.trim();
  } catch {
    return null;
  }
}
