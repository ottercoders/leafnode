import type { NatsConnection } from "@nats-io/transport-node";
import {
  jetstream,
  jetstreamManager,
  type JetStreamClient,
  type JetStreamManager,
  type StoredMsg,
} from "@nats-io/jetstream";
import type {
  StreamInfoView,
  StreamConfigView,
  StreamStateView,
  ConsumerInfoView,
  NatsMessageView,
  MessageQueryOpts,
} from "../types/nats";
import { toDisplayString } from "../utils/codec";

export class JetStreamService {
  private js: JetStreamClient;
  private jsmPromise: Promise<JetStreamManager>;

  constructor(nc: NatsConnection) {
    this.js = jetstream(nc);
    this.jsmPromise = jetstreamManager(nc);
  }

  async listStreams(): Promise<StreamInfoView[]> {
    const jsm = await this.jsmPromise;
    const streams: StreamInfoView[] = [];
    for await (const si of jsm.streams.list()) {
      streams.push(toStreamInfoView(si));
    }
    return streams;
  }

  async getStream(name: string): Promise<StreamInfoView> {
    const jsm = await this.jsmPromise;
    const si = await jsm.streams.info(name);
    return toStreamInfoView(si);
  }

  async getStreamMessages(
    streamName: string,
    opts: MessageQueryOpts,
  ): Promise<NatsMessageView[]> {
    const jsm = await this.jsmPromise;
    const messages: NatsMessageView[] = [];
    const startSeq = opts.startSeq ?? 1;
    const limit = opts.limit;

    for (let seq = startSeq; messages.length < limit; seq++) {
      const endSeq = opts.endSeq;
      if (endSeq !== undefined && seq > endSeq) break;

      try {
        const msg = await jsm.streams.getMessage(streamName, { seq });
        if (!msg) break;

        if (opts.subject && !matchesFilter(msg.subject, opts.subject)) {
          continue;
        }

        messages.push(storedMsgToView(msg));
      } catch {
        // Past last message or error
        break;
      }
    }

    return messages;
  }

  async purgeStream(name: string): Promise<void> {
    const jsm = await this.jsmPromise;
    await jsm.streams.purge(name);
  }

  async deleteStream(name: string): Promise<void> {
    const jsm = await this.jsmPromise;
    await jsm.streams.delete(name);
  }

  async listConsumers(stream: string): Promise<ConsumerInfoView[]> {
    const jsm = await this.jsmPromise;
    const consumers: ConsumerInfoView[] = [];
    for await (const ci of jsm.consumers.list(stream)) {
      consumers.push({
        name: ci.name,
        stream: ci.stream_name,
        config: {
          durableName: ci.config.durable_name,
          filterSubject: ci.config.filter_subject,
          ackPolicy: ci.config.ack_policy,
          deliverPolicy: ci.config.deliver_policy,
          maxDeliver: ci.config.max_deliver ?? -1,
        },
        numPending: ci.num_pending,
        numAckPending: ci.num_ack_pending,
        numRedelivered: ci.num_redelivered,
      });
    }
    return consumers;
  }
}

function toStreamInfoView(si: {
  config: { name: string; subjects?: string[]; retention: string; storage: string; num_replicas: number; max_msgs: number; max_bytes: number; max_age: number; max_msg_size: number; discard: string };
  state: { messages: number; bytes: number; first_seq: number; last_seq: number; first_ts: string; last_ts: string; consumer_count: number };
}): StreamInfoView {
  return {
    name: si.config.name,
    config: toStreamConfigView(si.config),
    state: toStreamStateView(si.state),
  };
}

function toStreamConfigView(c: {
  subjects?: string[];
  retention: string;
  storage: string;
  num_replicas: number;
  max_msgs: number;
  max_bytes: number;
  max_age: number;
  max_msg_size: number;
  discard: string;
}): StreamConfigView {
  return {
    subjects: c.subjects ?? [],
    retention: c.retention,
    storage: c.storage,
    replicas: c.num_replicas,
    maxMsgs: c.max_msgs,
    maxBytes: c.max_bytes,
    maxAge: c.max_age,
    maxMsgSize: c.max_msg_size,
    discard: c.discard,
  };
}

function toStreamStateView(s: {
  messages: number;
  bytes: number;
  first_seq: number;
  last_seq: number;
  first_ts: string;
  last_ts: string;
  consumer_count: number;
}): StreamStateView {
  return {
    messages: s.messages,
    bytes: s.bytes,
    firstSeq: s.first_seq,
    lastSeq: s.last_seq,
    firstTs: s.first_ts,
    lastTs: s.last_ts,
    consumerCount: s.consumer_count,
  };
}

function storedMsgToView(msg: StoredMsg): NatsMessageView {
  const { text, encoding } = toDisplayString(msg.data);
  const headers: Record<string, string[]> | undefined = msg.header
    ? Object.fromEntries(
        [...msg.header.keys()].map((k) => [k, msg.header!.values(k)]),
      )
    : undefined;

  return {
    subject: msg.subject,
    sequence: msg.seq,
    timestamp: msg.timestamp,
    headers,
    payload: text,
    payloadEncoding: encoding,
    size: msg.data.length,
  };
}

function matchesFilter(subject: string, filter: string): boolean {
  if (filter === ">") return true;
  const subParts = subject.split(".");
  const filterParts = filter.split(".");
  for (let i = 0; i < filterParts.length; i++) {
    if (filterParts[i] === ">") return i < subParts.length;
    if (i >= subParts.length) return false;
    if (filterParts[i] !== "*" && filterParts[i] !== subParts[i]) return false;
  }
  return subParts.length === filterParts.length;
}
