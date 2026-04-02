import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function isNatsCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync("nats", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export interface NatsCommand {
  label: string;
  args: string[];
}

export const COMMON_COMMANDS: NatsCommand[] = [
  { label: "List Streams", args: ["stream", "ls"] },
  { label: "List Consumers", args: ["consumer", "ls"] },
  { label: "List KV Stores", args: ["kv", "ls"] },
  { label: "Server Info", args: ["server", "info"] },
  { label: "Account Info", args: ["account", "info"] },
];
