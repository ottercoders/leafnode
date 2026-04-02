import type { NatsConnection, Subscription } from "@nats-io/transport-node";
import type { NatsMessageView } from "../types/nats";
import { toDisplayString } from "../utils/codec";

export interface ActiveSubscription {
  unsubscribe(): void;
  messages: AsyncIterable<NatsMessageView>;
}

export class NatsService {
  constructor(private nc: NatsConnection) {}

  async publish(
    subject: string,
    payload: Uint8Array,
    opts?: { headers?: Record<string, string>; replyTo?: string },
  ): Promise<void> {
    const pubOpts: { reply?: string; headers?: import("@nats-io/transport-node").MsgHdrs } = {};
    if (opts?.replyTo) {
      pubOpts.reply = opts.replyTo;
    }
    if (opts?.headers) {
      const { headers } = await import("@nats-io/transport-node");
      const hdrs = headers();
      for (const [k, v] of Object.entries(opts.headers)) {
        hdrs.set(k, v);
      }
      pubOpts.headers = hdrs;
    }
    this.nc.publish(subject, payload, pubOpts);
  }

  subscribe(subject: string): ActiveSubscription {
    const sub = this.nc.subscribe(subject);
    return {
      unsubscribe: () => sub.unsubscribe(),
      messages: toAsyncIterable(sub),
    };
  }

  async request(
    subject: string,
    payload: Uint8Array,
    opts?: {
      timeout?: number;
      headers?: Record<string, string>;
    },
  ): Promise<NatsMessageView> {
    const reqOpts: { timeout: number; headers?: import("@nats-io/transport-node").MsgHdrs } = {
      timeout: opts?.timeout ?? 5000,
    };
    if (opts?.headers) {
      const { headers } = await import("@nats-io/transport-node");
      const hdrs = headers();
      for (const [k, v] of Object.entries(opts.headers)) {
        hdrs.set(k, v);
      }
      reqOpts.headers = hdrs;
    }

    const msg = await this.nc.request(subject, payload, reqOpts);
    return msgToView(msg);
  }
}

async function* toAsyncIterable(
  sub: Subscription,
): AsyncIterable<NatsMessageView> {
  for await (const msg of sub) {
    yield msgToView(msg);
  }
}

function msgToView(msg: {
  subject: string;
  data: Uint8Array;
  headers?: { keys(): Iterable<string>; values(k: string): string[] };
}): NatsMessageView {
  const { text, encoding } = toDisplayString(msg.data);
  const msgHeaders: Record<string, string[]> | undefined = msg.headers
    ? Object.fromEntries(
        [...msg.headers.keys()].map((k) => [k, msg.headers!.values(k)]),
      )
    : undefined;

  return {
    subject: msg.subject,
    timestamp: new Date().toISOString(),
    headers: msgHeaders,
    payload: text,
    payloadEncoding: encoding,
    size: msg.data.length,
  };
}
