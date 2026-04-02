import { connect, type NatsConnection } from "@nats-io/transport-node";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

let connection: NatsConnection | null = null;

export async function getConnection(): Promise<NatsConnection> {
  if (connection) return connection;
  connection = await connect({ servers: [NATS_URL] });
  return connection;
}

export async function cleanup(): Promise<void> {
  if (connection) {
    await connection.drain().catch(() => {});
    connection = null;
  }
}

export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
