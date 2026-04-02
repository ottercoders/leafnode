import type { NatsConnection } from "@nats-io/transport-node";
import { jetstreamManager } from "@nats-io/jetstream";
import { Kvm } from "@nats-io/kv";
import type { KvBucketInfoView, KvEntryView } from "../types/nats";
import { toDisplayString } from "../utils/codec";

export class KvService {
  private kvm: Kvm;
  private nc: NatsConnection;

  constructor(nc: NatsConnection) {
    this.nc = nc;
    this.kvm = new Kvm(nc);
  }

  async listBuckets(): Promise<KvBucketInfoView[]> {
    const buckets: KvBucketInfoView[] = [];
    for await (const status of this.kvm.list()) {
      buckets.push({
        bucket: status.bucket,
        values: status.values,
        bytes: status.size,
        history: status.history,
        ttl: status.ttl,
        replicas: status.replicas,
      });
    }
    return buckets;
  }

  async getKeys(bucketName: string): Promise<string[]> {
    const kv = await this.kvm.open(bucketName);
    const keys: string[] = [];
    for await (const key of await kv.keys()) {
      keys.push(key);
    }
    return keys;
  }

  async get(bucketName: string, key: string): Promise<KvEntryView | null> {
    const kv = await this.kvm.open(bucketName);
    const entry = await kv.get(key);
    if (!entry) return null;
    return kvEntryToView(entry);
  }

  async put(
    bucketName: string,
    key: string,
    value: Uint8Array,
  ): Promise<number> {
    const kv = await this.kvm.open(bucketName);
    return kv.put(key, value);
  }

  async delete(bucketName: string, key: string): Promise<void> {
    const kv = await this.kvm.open(bucketName);
    await kv.delete(key);
  }

  async purge(bucketName: string, key: string): Promise<void> {
    const kv = await this.kvm.open(bucketName);
    await kv.purge(key);
  }

  async history(
    bucketName: string,
    key: string,
  ): Promise<KvEntryView[]> {
    const kv = await this.kvm.open(bucketName);
    const entries: KvEntryView[] = [];
    for await (const entry of await kv.history({ key })) {
      entries.push(kvEntryToView(entry));
    }
    return entries;
  }

  async *watchEntries(
    bucketName: string,
    key?: string,
  ): AsyncIterable<KvEntryView> {
    const kv = await this.kvm.open(bucketName);
    const iter = await kv.watch(key ? { key } : undefined);
    for await (const entry of iter) {
      yield kvEntryToView(entry);
    }
  }

  async createBucket(
    name: string,
    opts?: { history?: number; ttl?: number; replicas?: number; maxBytes?: number },
  ): Promise<void> {
    await this.kvm.create(name, {
      history: opts?.history,
      ttl: opts?.ttl,
      replicas: opts?.replicas,
      max_bytes: opts?.maxBytes,
    });
  }

  async deleteBucket(name: string): Promise<void> {
    const kv = await this.kvm.open(name);
    const status = await kv.status();
    const jsm = await jetstreamManager(this.nc);
    await jsm.streams.delete(status.streamInfo.config.name);
  }
}

function kvEntryToView(entry: {
  key: string;
  value: Uint8Array;
  revision: number;
  created: Date;
  operation: string;
}): KvEntryView {
  const { text, encoding } = toDisplayString(entry.value);
  return {
    key: entry.key,
    value: text,
    valueEncoding: encoding,
    revision: entry.revision,
    created: entry.created.toISOString(),
    operation: entry.operation,
  };
}
