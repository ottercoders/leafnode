import * as vscode from "vscode";
import type { ConnectionConfig, AuthConfig } from "../../types/connection";
import type { ConnectionManager } from "../../connections/manager";

function generateId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function runConnectionWizard(
  manager: ConnectionManager,
  existingConfig?: ConnectionConfig,
): Promise<ConnectionConfig | undefined> {
  const isEdit = !!existingConfig;
  const titlePrefix = isEdit ? "Edit" : "Add";

  // Step 1: Name
  const name = await vscode.window.showInputBox({
    title: `${titlePrefix} NATS Connection (1/4)`,
    prompt: "Connection name",
    placeHolder: "e.g. local-dev",
    value: existingConfig?.name ?? "",
    validateInput: (v) => (v.trim() ? undefined : "Name is required"),
  });
  if (!name) return undefined;

  // Step 2: Server URL(s)
  const serversInput = await vscode.window.showInputBox({
    title: `${titlePrefix} NATS Connection (2/4)`,
    prompt: "Server URL(s), comma-separated",
    placeHolder: "nats://localhost:4222",
    value: existingConfig?.servers.join(", ") ?? "nats://localhost:4222",
    validateInput: (v) =>
      v.trim() ? undefined : "At least one server URL is required",
  });
  if (!serversInput) return undefined;
  const servers = serversInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Step 3: Auth type
  const authOptions = [
    { label: "Anonymous", description: "No authentication", value: "anonymous" as const },
    { label: "Token", description: "Bearer token", value: "token" as const },
    { label: "Username/Password", description: "Basic auth", value: "userpass" as const },
    { label: "NKey", description: "NKey seed file", value: "nkey" as const },
    { label: "Credentials File", description: ".creds file", value: "credentials" as const },
    { label: "TLS Client Certificate", description: "Mutual TLS", value: "tls" as const },
  ];

  // Pre-select current auth type when editing
  const defaultAuth = existingConfig?.auth.type ?? "anonymous";
  const sortedOptions = authOptions.sort((a, b) => {
    if (a.value === defaultAuth) return -1;
    if (b.value === defaultAuth) return 1;
    return 0;
  });

  const authType = await vscode.window.showQuickPick(sortedOptions, {
    title: `${titlePrefix} NATS Connection (3/4)`,
    placeHolder: `Authentication method${isEdit ? ` (current: ${defaultAuth})` : ""}`,
  });
  if (!authType) return undefined;

  const id = existingConfig?.id ?? generateId();
  let auth: AuthConfig;

  switch (authType.value) {
    case "anonymous":
      auth = { type: "anonymous" };
      break;

    case "token": {
      const token = await vscode.window.showInputBox({
        title: `${titlePrefix} NATS Connection (3/4)`,
        prompt: "Auth token",
        password: true,
      });
      if (token === undefined) return undefined;
      const secretKey = `leafnode.${id}.token`;
      await manager.storeSecret(id, "token", token);
      auth = { type: "token", tokenSecret: secretKey };
      break;
    }

    case "userpass": {
      const existingUser =
        existingConfig?.auth.type === "userpass"
          ? existingConfig.auth.user
          : "";
      const user = await vscode.window.showInputBox({
        title: `${titlePrefix} NATS Connection (3/4)`,
        prompt: "Username",
        value: existingUser,
      });
      if (user === undefined) return undefined;
      const pass = await vscode.window.showInputBox({
        title: `${titlePrefix} NATS Connection (3/4)`,
        prompt: "Password",
        password: true,
      });
      if (pass === undefined) return undefined;
      const secretKey = `leafnode.${id}.password`;
      await manager.storeSecret(id, "password", pass);
      auth = { type: "userpass", user, passSecret: secretKey };
      break;
    }

    case "nkey": {
      const fileUri = await vscode.window.showOpenDialog({
        title: "Select NKey seed file",
        filters: { "NKey files": ["nk", "nkey", "seed", "*"] },
      });
      if (!fileUri?.[0]) return undefined;
      const content = Buffer.from(
        await vscode.workspace.fs.readFile(fileUri[0]),
      ).toString("utf-8");
      const seed =
        content
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("S")) ?? content.trim();
      const secretKey = `leafnode.${id}.nkeySeed`;
      await manager.storeSecret(id, "nkeySeed", seed);
      auth = { type: "nkey", seedSecret: secretKey };
      break;
    }

    case "credentials": {
      const fileUri = await vscode.window.showOpenDialog({
        title: "Select credentials file",
        filters: { "Credentials files": ["creds", "*"] },
      });
      if (!fileUri?.[0]) return undefined;
      const content = Buffer.from(
        await vscode.workspace.fs.readFile(fileUri[0]),
      ).toString("utf-8");
      const secretKey = `leafnode.${id}.creds`;
      await manager.storeSecret(id, "creds", content);
      auth = { type: "credentials", credsSecret: secretKey };
      break;
    }

    case "tls": {
      const certUri = await vscode.window.showOpenDialog({
        title: "Select TLS client certificate",
        filters: { Certificates: ["pem", "crt", "cert"] },
      });
      if (!certUri?.[0]) return undefined;
      const keyUri = await vscode.window.showOpenDialog({
        title: "Select TLS client key",
        filters: { Keys: ["pem", "key"] },
      });
      if (!keyUri?.[0]) return undefined;
      const caUri = await vscode.window.showOpenDialog({
        title: "Select CA certificate (optional — press Escape to skip)",
        filters: { Certificates: ["pem", "crt", "cert"] },
      });
      auth = {
        type: "tls",
        certPath: certUri[0].fsPath,
        keyPath: keyUri[0].fsPath,
        caPath: caUri?.[0]?.fsPath,
      };
      break;
    }
  }

  // Step 4: Monitoring URL (optional)
  const monitoringUrl = await vscode.window.showInputBox({
    title: `${titlePrefix} NATS Connection (4/4)`,
    prompt: "Monitoring URL (optional)",
    placeHolder: "http://localhost:8222",
    value: existingConfig?.monitoringUrl ?? "",
  });

  const config: ConnectionConfig = {
    id,
    name: name.trim(),
    servers,
    auth,
    monitoringUrl: monitoringUrl?.trim() || undefined,
  };

  if (isEdit) {
    await manager.updateConnection(id, config);
  } else {
    await manager.addConnection(config);
  }
  return config;
}
