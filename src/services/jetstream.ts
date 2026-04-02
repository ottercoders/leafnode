import type { NatsConnection } from "@nats-io/transport-node";
import {
  jetstream,
  jetstreamManager,
  DeliverPolicy,
  type ConsumerConfig,
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
    // Time-based browsing uses ordered consumer
    if (opts.startTime) {
      return this.getMessagesByTime(streamName, opts);
    }

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

  private async getMessagesByTime(
    streamName: string,
    opts: MessageQueryOpts,
  ): Promise<NatsMessageView[]> {
    const stream = await this.js.streams.get(streamName);
    const consumer = await stream.getConsumer({
      deliver_policy: DeliverPolicy.StartTime,
      opt_start_time: opts.startTime!,
      filter_subjects: opts.subject ? [opts.subject] : undefined,
    });

    const messages: NatsMessageView[] = [];
    const batch = await consumer.fetch({ max_messages: opts.limit, expires: 5000 });
    for await (const msg of batch) {
      const { text, encoding } = toDisplayString(msg.data);
      const headers: Record<string, string[]> | undefined = msg.headers
        ? Object.fromEntries(
            [...msg.headers.keys()].map((k) => [k, msg.headers!.values(k)]),
          )
        : undefined;
      messages.push({
        subject: msg.subject,
        sequence: msg.seq,
        timestamp: new Date(Number(BigInt(msg.info.timestampNanos) / 1_000_000n)).toISOString(),
        headers,
        payload: text,
        payloadEncoding: encoding,
        size: msg.data.length,
      });
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

  async createConsumer(
    stream: string,
    config: Partial<ConsumerConfig>,
  ): Promise<ConsumerInfoView> {
    const jsm = await this.jsmPromise;
    const ci = await jsm.consumers.add(stream, config);
    return {
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
    };
  }

  async deleteConsumer(stream: string, name: string): Promise<void> {
    const jsm = await this.jsmPromise;
    await jsm.consumers.delete(stream, name);
  }

  async pauseConsumer(stream: string, name: string): Promise<void> {
    const jsm = await this.jsmPromise;
    // Pause indefinitely (far future date)
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await jsm.consumers.pause(stream, name, farFuture);
  }

  async resumeConsumer(stream: string, name: string): Promise<void> {
    const jsm = await this.jsmPromise;
    await jsm.consumers.resume(stream, name);
  }

  async createStream(config: {
    name: string;
    subjects: string[];
    retention?: string;
    storage?: string;
    replicas?: number;
    maxMsgs?: number;
    maxBytes?: number;
    maxAge?: number;
  }): Promise<StreamInfoView> {
    const jsm = await this.jsmPromise;
    const si = await jsm.streams.add({
      name: config.name,
      subjects: config.subjects,
      retention: (config.retention ?? "limits") as "limits" | "interest" | "workqueue",
      storage: (config.storage ?? "file") as "file" | "memory",
      num_replicas: config.replicas ?? 1,
      max_msgs: config.maxMsgs ?? -1,
      max_bytes: config.maxBytes ?? -1,
      max_age: config.maxAge ?? 0,
    });
    return toStreamInfoView(si);
  }

  async updateStream(
    name: string,
    config: Partial<{
      subjects: string[];
      maxMsgs: number;
      maxBytes: number;
      maxAge: number;
    }>,
  ): Promise<StreamInfoView> {
    const jsm = await this.jsmPromise;
    const current = await jsm.streams.info(name);
    const updated = { ...current.config };
    if (config.subjects !== undefined) updated.subjects = config.subjects;
    if (config.maxMsgs !== undefined) updated.max_msgs = config.maxMsgs;
    if (config.maxBytes !== undefined) updated.max_bytes = config.maxBytes;
    if (config.maxAge !== undefined) updated.max_age = config.maxAge;
    const si = await jsm.streams.update(name, updated);
    return toStreamInfoView(si);
  }

  async sealStream(name: string): Promise<void> {
    const jsm = await this.jsmPromise;
    const current = await jsm.streams.info(name);
    const updated = { ...current.config, sealed: true };
    await jsm.streams.update(name, updated);
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
