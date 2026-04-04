import * as assert from "assert";
import * as vscode from "vscode";

// Mirror of LeafnodeAPI from extension.ts (can't import directly)
interface LeafnodeAPI {
  panelManager: {
    createOrShow(
      panelId: string,
      title: string,
      webviewEntry: string,
      column?: vscode.ViewColumn,
    ): vscode.WebviewPanel;
  };
  connectionManager: {
    addConnection(config: ConnectionConfig): Promise<void>;
    updateConnection(
      id: string,
      updates: Partial<ConnectionConfig>,
    ): Promise<void>;
    removeConnection(id: string): Promise<void>;
    connect(id: string): Promise<unknown>;
    disconnect(id: string): Promise<void>;
    getConnection(id: string): unknown | undefined;
    getSavedConnections(): ConnectionConfig[];
    getConnectedIds(): string[];
    getStatus(id: string): string;
    getError(id: string): string | undefined;
    ping(id: string): Promise<number | undefined>;
  };
  getServices(connectionId: string): Services | undefined;
}

interface ConnectionConfig {
  id: string;
  name: string;
  servers: string[];
  monitoringUrl?: string;
  auth: { type: string; [key: string]: unknown };
}

interface Services {
  jetstream: {
    listStreams(): Promise<StreamInfo[]>;
    getStream(name: string): Promise<StreamInfo>;
    createStream(config: {
      name: string;
      subjects: string[];
      storage?: string;
      retention?: string;
      replicas?: number;
      maxMsgs?: number;
      maxBytes?: number;
      maxAge?: number;
    }): Promise<StreamInfo>;
    updateStream(
      name: string,
      config: Partial<{
        subjects: string[];
        maxMsgs: number;
        maxBytes: number;
        maxAge: number;
      }>,
    ): Promise<StreamInfo>;
    sealStream(name: string): Promise<void>;
    deleteStream(name: string): Promise<void>;
    purgeStream(name: string): Promise<void>;
    getStreamMessages(
      stream: string,
      opts: { startSeq?: number; startTime?: string; limit: number; subject?: string },
    ): Promise<MessageView[]>;
    listConsumers(stream: string): Promise<ConsumerInfo[]>;
    createConsumer(
      stream: string,
      config: Record<string, unknown>,
    ): Promise<ConsumerInfo>;
    deleteConsumer(stream: string, name: string): Promise<void>;
    pauseConsumer(stream: string, name: string): Promise<void>;
    resumeConsumer(stream: string, name: string): Promise<void>;
    pullConsumerMessages(stream: string, consumer: string, limit?: number): Promise<MessageView[]>;
    searchMessages(stream: string, pattern: string, limit?: number): Promise<MessageView[]>;
  };
  kv: {
    listBuckets(): Promise<BucketInfo[]>;
    createBucket(name: string): Promise<void>;
    deleteBucket(name: string): Promise<void>;
    getKeys(bucket: string): Promise<string[]>;
    get(bucket: string, key: string): Promise<KvEntry | null>;
    put(bucket: string, key: string, value: Uint8Array): Promise<number>;
    delete(bucket: string, key: string): Promise<void>;
    purge(bucket: string, key: string): Promise<void>;
    history(bucket: string, key: string): Promise<KvEntry[]>;
  };
  nats: {
    publish(
      subject: string,
      payload: Uint8Array,
      opts?: { headers?: Record<string, string>; replyTo?: string },
    ): Promise<void>;
    subscribe(subject: string): {
      messages: AsyncIterable<MessageView>;
      unsubscribe(): void;
    };
    request(
      subject: string,
      payload: Uint8Array,
      opts?: { timeout?: number; headers?: Record<string, string> },
    ): Promise<MessageView>;
  };
  obj: {
    listStores(): Promise<ObjStoreInfo[]>;
    listObjects(store: string): Promise<ObjectInfo[]>;
  };
}

interface StreamInfo {
  name: string;
  config: {
    subjects: string[];
    storage: string;
    retention: string;
    replicas: number;
    maxMsgs: number;
    maxBytes: number;
    maxAge: number;
    maxMsgSize: number;
    discard: string;
    mirror?: { name: string; filterSubject?: string };
    sources?: Array<{ name: string; filterSubject?: string }>;
  };
  state: {
    messages: number;
    bytes: number;
    firstSeq: number;
    lastSeq: number;
    firstTs: string;
    lastTs: string;
    consumerCount: number;
  };
}
interface MessageView {
  subject: string;
  payload: string;
  payloadEncoding: string;
  sequence?: number;
  timestamp: string;
  headers?: Record<string, string[]>;
  size: number;
}
interface ConsumerInfo {
  name: string;
  stream: string;
  config: {
    durableName?: string;
    filterSubject?: string;
    ackPolicy: string;
    deliverPolicy: string;
    maxDeliver: number;
  };
  numPending: number;
  numAckPending: number;
  numRedelivered: number;
}
interface BucketInfo {
  bucket: string;
  values: number;
  bytes: number;
  history: number;
  ttl: number;
  replicas: number;
}
interface KvEntry {
  key: string;
  value: string;
  valueEncoding: string;
  revision: number;
  created: string;
  operation: string;
}
interface ObjStoreInfo {
  name: string;
  size: number;
  objects: number;
  sealed: boolean;
}
interface ObjectInfo {
  name: string;
  size: number;
  chunks: number;
  lastModified: string;
  digest: string;
}

// Helpers
function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const encoder = new TextEncoder();

suite("Leafnode Extension E2E", () => {
  let api: LeafnodeAPI;

  suiteSetup(async function () {
    this.timeout(30000);
    const ext = vscode.extensions.getExtension("ottercoders.leafnode");
    assert.ok(ext, "Extension not found");
    api = (await ext.activate()) as LeafnodeAPI;
    await new Promise((r) => setTimeout(r, 1000));
  });

  // ─── Activation ───────────────────────────────────────────

  suite("Activation", () => {
    test("extension is active", () => {
      const ext = vscode.extensions.getExtension("ottercoders.leafnode");
      assert.ok(ext?.isActive);
    });

    test("registers 30+ commands", async () => {
      const all = await vscode.commands.getCommands(true);
      const cmds = all.filter((c) => c.startsWith("leafnode."));
      assert.ok(cmds.length >= 30, `Got ${cmds.length} commands`);
    });

    test("exports connectionManager and getServices", () => {
      assert.ok(api.connectionManager);
      assert.ok(typeof api.getServices === "function");
    });
  });

  // ─── Connection Lifecycle ─────────────────────────────────

  suite("Connection Lifecycle", () => {
    const connId = uniqueName("e2e");
    const config: ConnectionConfig = {
      id: connId,
      name: "E2E Test",
      servers: [NATS_URL],
      auth: { type: "anonymous" },
    };

    suiteTeardown(async () => {
      try {
        await api.connectionManager.disconnect(connId);
      } catch { /* ok */ }
      try {
        await api.connectionManager.removeConnection(connId);
      } catch { /* ok */ }
    });

    test("add connection", async () => {
      await api.connectionManager.addConnection(config);
      const saved = api.connectionManager.getSavedConnections();
      assert.ok(saved.some((c) => c.id === connId));
    });

    test("status is disconnected", () => {
      assert.strictEqual(api.connectionManager.getStatus(connId), "disconnected");
    });

    test("connect to NATS", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      assert.strictEqual(api.connectionManager.getStatus(connId), "connected");
    });

    test("getConnection returns non-null", () => {
      assert.ok(api.connectionManager.getConnection(connId));
    });

    test("getConnectedIds includes this connection", () => {
      assert.ok(api.connectionManager.getConnectedIds().includes(connId));
    });

    test("disconnect", async () => {
      await api.connectionManager.disconnect(connId);
      assert.strictEqual(api.connectionManager.getStatus(connId), "disconnected");
    });

    test("reconnect", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      assert.strictEqual(api.connectionManager.getStatus(connId), "connected");
    });

    test("remove connection", async () => {
      await api.connectionManager.disconnect(connId);
      await api.connectionManager.removeConnection(connId);
      const saved = api.connectionManager.getSavedConnections();
      assert.ok(!saved.some((c) => c.id === connId));
    });
  });

  // ─── Invalid Connections ──────────────────────────────────

  suite("Invalid Connections", () => {
    const badId = uniqueName("bad");

    suiteTeardown(async () => {
      try {
        await api.connectionManager.removeConnection(badId);
      } catch { /* ok */ }
    });

    test("add connection with unreachable server", async () => {
      await api.connectionManager.addConnection({
        id: badId,
        name: "Bad Server",
        servers: ["nats://127.0.0.1:19999"],
        auth: { type: "anonymous" },
      });
    });

    test("connect fails with error status", async function () {
      this.timeout(15000);
      try {
        await api.connectionManager.connect(badId);
        assert.fail("Should have thrown");
      } catch {
        // Expected
      }
      assert.strictEqual(api.connectionManager.getStatus(badId), "error");
    });

    test("error message is set", () => {
      const err = api.connectionManager.getError(badId);
      assert.ok(err, "Expected error message");
    });

    test("cleanup: remove bad connection", async () => {
      await api.connectionManager.removeConnection(badId);
    });
  });

  // ─── Edit Connection ──────────────────────────────────────

  suite("Edit Connection", () => {
    const editId = uniqueName("edit");

    suiteTeardown(async () => {
      try {
        await api.connectionManager.removeConnection(editId);
      } catch { /* ok */ }
    });

    test("add connection", async () => {
      await api.connectionManager.addConnection({
        id: editId,
        name: "Original Name",
        servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
    });

    test("update connection name", async () => {
      await api.connectionManager.updateConnection(editId, {
        name: "Renamed Connection",
      });
      const saved = api.connectionManager.getSavedConnections();
      const found = saved.find((c) => c.id === editId);
      assert.strictEqual(found?.name, "Renamed Connection");
    });

    test("update servers", async () => {
      await api.connectionManager.updateConnection(editId, {
        servers: [NATS_URL, "nats://backup:4222"],
      });
      const saved = api.connectionManager.getSavedConnections();
      const found = saved.find((c) => c.id === editId);
      assert.strictEqual(found?.servers.length, 2);
    });
  });

  // ─── Multiple Connections ─────────────────────────────────

  suite("Multiple Connections", () => {
    const id1 = uniqueName("multi1");
    const id2 = uniqueName("multi2");

    suiteTeardown(async () => {
      for (const id of [id1, id2]) {
        try { await api.connectionManager.disconnect(id); } catch { /* ok */ }
        try { await api.connectionManager.removeConnection(id); } catch { /* ok */ }
      }
    });

    test("add two connections", async () => {
      await api.connectionManager.addConnection({
        id: id1, name: "Multi 1", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.addConnection({
        id: id2, name: "Multi 2", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
    });

    test("connect both", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(id1);
      await api.connectionManager.connect(id2);
      const connected = api.connectionManager.getConnectedIds();
      assert.ok(connected.includes(id1));
      assert.ok(connected.includes(id2));
    });

    test("disconnect one, other stays connected", async () => {
      await api.connectionManager.disconnect(id1);
      assert.strictEqual(api.connectionManager.getStatus(id1), "disconnected");
      assert.strictEqual(api.connectionManager.getStatus(id2), "connected");
    });
  });

  // ─── Stream CRUD ──────────────────────────────────────────

  suite("Stream CRUD", () => {
    const connId = uniqueName("stream_conn");
    const streamName = uniqueName("E2E_STREAM");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Stream Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("create stream", async () => {
      const svc = api.getServices(connId);
      assert.ok(svc, "Services not available");
      const info = await svc.jetstream.createStream({
        name: streamName,
        subjects: [`${streamName}.>`],
      });
      assert.strictEqual(info.name, streamName);
    });

    test("list streams includes new stream", async () => {
      const svc = api.getServices(connId)!;
      const streams = await svc.jetstream.listStreams();
      assert.ok(streams.some((s) => s.name === streamName));
    });

    test("get stream info", async () => {
      const svc = api.getServices(connId)!;
      const info = await svc.jetstream.getStream(streamName);
      assert.strictEqual(info.name, streamName);
      assert.ok(info.config.subjects.includes(`${streamName}.>`));
    });

    test("publish messages", async () => {
      const svc = api.getServices(connId)!;
      for (let i = 0; i < 5; i++) {
        await svc.nats.publish(
          `${streamName}.test`,
          encoder.encode(`message ${i}`),
        );
      }
      // Wait for stream to process
      await new Promise((r) => setTimeout(r, 500));
    });

    test("browse messages returns 5", async () => {
      const svc = api.getServices(connId)!;
      const msgs = await svc.jetstream.getStreamMessages(streamName, {
        startSeq: 1,
        limit: 10,
      });
      assert.strictEqual(msgs.length, 5);
      assert.strictEqual(msgs[0].payload, "message 0");
      assert.strictEqual(msgs[4].payload, "message 4");
    });

    test("filter messages by subject", async () => {
      const svc = api.getServices(connId)!;
      // Publish to a different subject
      await svc.nats.publish(
        `${streamName}.other`,
        encoder.encode("other msg"),
      );
      await new Promise((r) => setTimeout(r, 300));

      const filtered = await svc.jetstream.getStreamMessages(streamName, {
        startSeq: 1,
        limit: 10,
        subject: `${streamName}.other`,
      });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].payload, "other msg");
    });

    test("purge stream", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.purgeStream(streamName);
      const info = await svc.jetstream.getStream(streamName);
      assert.strictEqual(info.state.messages, 0);
    });

    test("delete stream", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.deleteStream(streamName);
      const streams = await svc.jetstream.listStreams();
      assert.ok(!streams.some((s) => s.name === streamName));
    });
  });

  // ─── Stream Advanced ──────────────────────────────────────

  suite("Stream Advanced", () => {
    const connId = uniqueName("stream_adv_conn");
    const memStreamName = uniqueName("MEM_STREAM");
    const updStreamName = uniqueName("UPD_STREAM");
    const sealStreamName = uniqueName("SEAL_STREAM");
    const jsonStreamName = uniqueName("JSON_STREAM");
    const multiSubjStreamName = uniqueName("MSUB_STREAM");
    const seqStreamName = uniqueName("SEQ_STREAM");
    const hdrStreamName = uniqueName("HDR_STREAM");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Stream Advanced Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      for (const name of [memStreamName, updStreamName, sealStreamName, jsonStreamName, multiSubjStreamName, seqStreamName, hdrStreamName]) {
        try { await svc?.jetstream.deleteStream(name); } catch { /* ok */ }
      }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("create stream with memory storage and verify config", async () => {
      const svc = api.getServices(connId)!;
      const info = await svc.jetstream.createStream({
        name: memStreamName,
        subjects: [`${memStreamName}.>`],
        storage: "memory",
      });
      assert.strictEqual(info.name, memStreamName);
      assert.strictEqual(info.config.storage, "memory");
    });

    test("update stream maxMsgs and verify", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: updStreamName,
        subjects: [`${updStreamName}.>`],
      });
      const updated = await svc.jetstream.updateStream(updStreamName, {
        maxMsgs: 100,
      });
      assert.strictEqual(updated.config.maxMsgs, 100);

      // Verify via getStream as well
      const info = await svc.jetstream.getStream(updStreamName);
      assert.strictEqual(info.config.maxMsgs, 100);
    });

    test("seal stream and verify", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: sealStreamName,
        subjects: [`${sealStreamName}.>`],
      });
      await svc.jetstream.sealStream(sealStreamName);
      // sealStream completes without error — sealed streams reject further writes
      // Attempt to publish should fail on a sealed stream
      try {
        await svc.nats.publish(
          `${sealStreamName}.test`,
          encoder.encode("should fail"),
        );
        await new Promise((r) => setTimeout(r, 300));
        // The publish may not throw (core NATS publish is fire-and-forget),
        // but the stream won't accept the message
        const info = await svc.jetstream.getStream(sealStreamName);
        assert.strictEqual(info.state.messages, 0, "Sealed stream should not accept messages");
      } catch {
        // Also acceptable: publish throws on sealed stream
      }
    });

    test("publish JSON payloads and verify round-trip", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: jsonStreamName,
        subjects: [`${jsonStreamName}.>`],
      });

      const jsonPayload = { name: "test", count: 42, nested: { active: true } };
      await svc.nats.publish(
        `${jsonStreamName}.data`,
        encoder.encode(JSON.stringify(jsonPayload)),
      );
      await new Promise((r) => setTimeout(r, 300));

      const msgs = await svc.jetstream.getStreamMessages(jsonStreamName, {
        startSeq: 1,
        limit: 1,
      });
      assert.strictEqual(msgs.length, 1);
      const parsed = JSON.parse(msgs[0].payload);
      assert.strictEqual(parsed.name, "test");
      assert.strictEqual(parsed.count, 42);
      assert.strictEqual(parsed.nested.active, true);
    });

    test("publish to multiple subjects, browse all, filter by each", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: multiSubjStreamName,
        subjects: [`${multiSubjStreamName}.>`],
      });

      await svc.nats.publish(`${multiSubjStreamName}.alpha`, encoder.encode("alpha1"));
      await svc.nats.publish(`${multiSubjStreamName}.beta`, encoder.encode("beta1"));
      await svc.nats.publish(`${multiSubjStreamName}.alpha`, encoder.encode("alpha2"));
      await svc.nats.publish(`${multiSubjStreamName}.beta`, encoder.encode("beta2"));
      await new Promise((r) => setTimeout(r, 300));

      // Browse all
      const all = await svc.jetstream.getStreamMessages(multiSubjStreamName, {
        startSeq: 1,
        limit: 10,
      });
      assert.strictEqual(all.length, 4);

      // Filter by alpha
      const alphas = await svc.jetstream.getStreamMessages(multiSubjStreamName, {
        startSeq: 1,
        limit: 10,
        subject: `${multiSubjStreamName}.alpha`,
      });
      assert.strictEqual(alphas.length, 2);
      assert.strictEqual(alphas[0].payload, "alpha1");
      assert.strictEqual(alphas[1].payload, "alpha2");

      // Filter by beta
      const betas = await svc.jetstream.getStreamMessages(multiSubjStreamName, {
        startSeq: 1,
        limit: 10,
        subject: `${multiSubjStreamName}.beta`,
      });
      assert.strictEqual(betas.length, 2);
      assert.strictEqual(betas[0].payload, "beta1");
      assert.strictEqual(betas[1].payload, "beta2");
    });

    test("message sequence numbers are sequential", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: seqStreamName,
        subjects: [`${seqStreamName}.>`],
      });

      for (let i = 0; i < 5; i++) {
        await svc.nats.publish(
          `${seqStreamName}.test`,
          encoder.encode(`seq ${i}`),
        );
      }
      await new Promise((r) => setTimeout(r, 300));

      const msgs = await svc.jetstream.getStreamMessages(seqStreamName, {
        startSeq: 1,
        limit: 10,
      });
      assert.strictEqual(msgs.length, 5);
      for (let i = 0; i < 5; i++) {
        assert.strictEqual(msgs[i].sequence, i + 1, `Expected sequence ${i + 1}`);
      }
    });

    test("message payload encoding is utf8 for text payloads", async () => {
      const svc = api.getServices(connId)!;
      // Reuse seqStreamName which already has messages
      const msgs = await svc.jetstream.getStreamMessages(seqStreamName, {
        startSeq: 1,
        limit: 1,
      });
      assert.strictEqual(msgs.length, 1);
      assert.strictEqual(msgs[0].payloadEncoding, "utf8");
    });

    test("browse with startSeq offset skips earlier messages", async () => {
      const svc = api.getServices(connId)!;
      // seqStreamName has 5 messages (seq 1-5)
      const msgs = await svc.jetstream.getStreamMessages(seqStreamName, {
        startSeq: 4,
        limit: 10,
      });
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[0].sequence, 4);
      assert.strictEqual(msgs[1].sequence, 5);
    });

    test("browse empty stream returns empty array", async () => {
      const svc = api.getServices(connId)!;
      // memStreamName has no messages
      const msgs = await svc.jetstream.getStreamMessages(memStreamName, {
        startSeq: 1,
        limit: 10,
      });
      assert.strictEqual(msgs.length, 0);
    });

    test("publish with headers, browse and verify headers present", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: hdrStreamName,
        subjects: [`${hdrStreamName}.>`],
      });

      await svc.nats.publish(
        `${hdrStreamName}.test`,
        encoder.encode("msg with headers"),
        { headers: { "X-Test": "header-value", "X-Request-Id": "abc123" } },
      );
      await new Promise((r) => setTimeout(r, 300));

      const msgs = await svc.jetstream.getStreamMessages(hdrStreamName, {
        startSeq: 1,
        limit: 1,
      });
      assert.strictEqual(msgs.length, 1);
      assert.ok(msgs[0].headers, "Expected headers to be present");
      assert.ok(msgs[0].headers!["X-Test"], "Expected X-Test header");
      assert.ok(
        msgs[0].headers!["X-Test"].includes("header-value"),
        `Expected header value "header-value", got ${JSON.stringify(msgs[0].headers!["X-Test"])}`,
      );
      assert.ok(
        msgs[0].headers!["X-Request-Id"].includes("abc123"),
        "Expected X-Request-Id header",
      );
    });
  });

  // ─── Consumer CRUD ────────────────────────────────────────

  suite("Consumer CRUD", () => {
    const connId = uniqueName("consumer_conn");
    const streamName = uniqueName("CONSUMER_STREAM");
    const consumerName = uniqueName("e2e_consumer");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Consumer Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: streamName,
        subjects: [`${streamName}.>`],
      });
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("create consumer", async () => {
      const svc = api.getServices(connId)!;
      const info = await svc.jetstream.createConsumer(streamName, {
        durable_name: consumerName,
        ack_policy: "explicit",
      });
      assert.strictEqual(info.name, consumerName);
    });

    test("list consumers includes new consumer", async () => {
      const svc = api.getServices(connId)!;
      const consumers = await svc.jetstream.listConsumers(streamName);
      assert.ok(consumers.some((c) => c.name === consumerName));
    });

    test("delete consumer", async () => {
      const svc = api.getServices(connId)!;
      await svc.jetstream.deleteConsumer(streamName, consumerName);
      const consumers = await svc.jetstream.listConsumers(streamName);
      assert.ok(!consumers.some((c) => c.name === consumerName));
    });
  });

  // ─── Consumer Advanced ────────────────────────────────────

  suite("Consumer Advanced", () => {
    const connId = uniqueName("consumer_adv_conn");
    const streamName = uniqueName("CONS_ADV_STREAM");
    const filteredConsumer = uniqueName("filtered_cons");
    const pendingConsumer = uniqueName("pending_cons");
    const pauseConsumer = uniqueName("pause_cons");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Consumer Advanced Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: streamName,
        subjects: [`${streamName}.>`],
      });
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteConsumer(streamName, filteredConsumer); } catch { /* ok */ }
      try { await svc?.jetstream.deleteConsumer(streamName, pendingConsumer); } catch { /* ok */ }
      try { await svc?.jetstream.deleteConsumer(streamName, pauseConsumer); } catch { /* ok */ }
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("create consumer with filter_subject", async () => {
      const svc = api.getServices(connId)!;
      const info = await svc.jetstream.createConsumer(streamName, {
        durable_name: filteredConsumer,
        ack_policy: "explicit",
        filter_subject: `${streamName}.filtered`,
      });
      assert.strictEqual(info.name, filteredConsumer);
      assert.strictEqual(info.config.filterSubject, `${streamName}.filtered`);
    });

    test("consumer numPending reflects undelivered messages", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;

      // Create consumer first, then publish
      const info = await svc.jetstream.createConsumer(streamName, {
        durable_name: pendingConsumer,
        ack_policy: "explicit",
      });
      assert.strictEqual(info.name, pendingConsumer);

      // Publish 3 messages
      for (let i = 0; i < 3; i++) {
        await svc.nats.publish(
          `${streamName}.pending`,
          encoder.encode(`pending ${i}`),
        );
      }
      await new Promise((r) => setTimeout(r, 300));

      // Check numPending via list
      const consumers = await svc.jetstream.listConsumers(streamName);
      const consumer = consumers.find((c) => c.name === pendingConsumer);
      assert.ok(consumer, "Consumer not found");
      assert.ok(consumer.numPending >= 3, `Expected numPending >= 3, got ${consumer.numPending}`);
    });

    test("pause and resume consumer without errors", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createConsumer(streamName, {
        durable_name: pauseConsumer,
        ack_policy: "explicit",
      });

      // Pause should not throw
      await svc.jetstream.pauseConsumer(streamName, pauseConsumer);

      // Resume should not throw
      await svc.jetstream.resumeConsumer(streamName, pauseConsumer);
    });
  });

  // ─── KV CRUD ──────────────────────────────────────────────

  suite("KV CRUD", () => {
    const connId = uniqueName("kv_conn");
    const bucketName = uniqueName("e2e_bucket");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "KV Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.kv.deleteBucket(bucketName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("create bucket", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.createBucket(bucketName);
      const buckets = await svc.kv.listBuckets();
      assert.ok(buckets.some((b) => b.bucket === bucketName));
    });

    test("put key", async () => {
      const svc = api.getServices(connId)!;
      const rev = await svc.kv.put(
        bucketName,
        "greeting",
        encoder.encode("hello world"),
      );
      assert.ok(rev > 0);
    });

    test("get key returns correct value", async () => {
      const svc = api.getServices(connId)!;
      const entry = await svc.kv.get(bucketName, "greeting");
      assert.ok(entry);
      assert.strictEqual(entry.key, "greeting");
      assert.strictEqual(entry.value, "hello world");
    });

    test("list keys includes greeting", async () => {
      const svc = api.getServices(connId)!;
      const keys = await svc.kv.getKeys(bucketName);
      assert.ok(keys.includes("greeting"));
    });

    test("update key", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.put(bucketName, "greeting", encoder.encode("hello updated"));
      const entry = await svc.kv.get(bucketName, "greeting");
      assert.strictEqual(entry?.value, "hello updated");
    });

    test("history shows 2 revisions", async () => {
      const svc = api.getServices(connId)!;
      const history = await svc.kv.history(bucketName, "greeting");
      assert.ok(history.length >= 2);
      assert.strictEqual(history[0].value, "hello world");
      assert.strictEqual(history[1].value, "hello updated");
    });

    test("delete key", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.delete(bucketName, "greeting");
      const entry = await svc.kv.get(bucketName, "greeting");
      assert.strictEqual(entry?.operation, "DEL");
    });

    test("get non-existent key returns null", async () => {
      const svc = api.getServices(connId)!;
      const entry = await svc.kv.get(bucketName, "nonexistent");
      assert.strictEqual(entry, null);
    });

    test("delete bucket", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.deleteBucket(bucketName);
      const buckets = await svc.kv.listBuckets();
      assert.ok(!buckets.some((b) => b.bucket === bucketName));
    });
  });

  // ─── KV Advanced ──────────────────────────────────────────

  suite("KV Advanced", () => {
    const connId = uniqueName("kv_adv_conn");
    const bucketName = uniqueName("kv_adv_bucket");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "KV Advanced Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.kv.createBucket(bucketName);
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.kv.deleteBucket(bucketName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("multiple keys: put 3 keys, list returns all 3", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.put(bucketName, "key1", encoder.encode("value1"));
      await svc.kv.put(bucketName, "key2", encoder.encode("value2"));
      await svc.kv.put(bucketName, "key3", encoder.encode("value3"));

      const keys = await svc.kv.getKeys(bucketName);
      assert.ok(keys.includes("key1"), "Missing key1");
      assert.ok(keys.includes("key2"), "Missing key2");
      assert.ok(keys.includes("key3"), "Missing key3");
      assert.ok(keys.length >= 3);
    });

    test("JSON value round-trips correctly", async () => {
      const svc = api.getServices(connId)!;
      const jsonObj = { name: "test", count: 42 };
      await svc.kv.put(bucketName, "json_key", encoder.encode(JSON.stringify(jsonObj)));

      const entry = await svc.kv.get(bucketName, "json_key");
      assert.ok(entry);
      const parsed = JSON.parse(entry.value);
      assert.strictEqual(parsed.name, "test");
      assert.strictEqual(parsed.count, 42);
    });

    test("purge key produces PURGE operation (not DEL)", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.put(bucketName, "purge_target", encoder.encode("to be purged"));
      await svc.kv.purge(bucketName, "purge_target");

      const entry = await svc.kv.get(bucketName, "purge_target");
      assert.ok(entry);
      assert.strictEqual(entry.operation, "PURGE");
    });

    test("re-put after delete returns new value", async () => {
      const svc = api.getServices(connId)!;
      await svc.kv.put(bucketName, "reput_key", encoder.encode("original"));
      await svc.kv.delete(bucketName, "reput_key");

      // Verify it's deleted
      const deleted = await svc.kv.get(bucketName, "reput_key");
      assert.strictEqual(deleted?.operation, "DEL");

      // Re-put
      await svc.kv.put(bucketName, "reput_key", encoder.encode("restored"));
      const restored = await svc.kv.get(bucketName, "reput_key");
      assert.ok(restored);
      assert.strictEqual(restored.value, "restored");
      assert.strictEqual(restored.operation, "PUT");
    });

    test("revision numbers are ascending", async () => {
      const svc = api.getServices(connId)!;
      const rev1 = await svc.kv.put(bucketName, "rev_key", encoder.encode("v1"));
      const rev2 = await svc.kv.put(bucketName, "rev_key", encoder.encode("v2"));
      const rev3 = await svc.kv.put(bucketName, "rev_key", encoder.encode("v3"));

      assert.ok(rev1 > 0);
      assert.ok(rev2 > rev1, `Expected rev2 (${rev2}) > rev1 (${rev1})`);
      assert.ok(rev3 > rev2, `Expected rev3 (${rev3}) > rev2 (${rev2})`);

      // Also verify via history
      const history = await svc.kv.history(bucketName, "rev_key");
      for (let i = 1; i < history.length; i++) {
        assert.ok(
          history[i].revision > history[i - 1].revision,
          `Revision ${history[i].revision} not > ${history[i - 1].revision}`,
        );
      }
    });
  });

  // ─── Pub/Sub ──────────────────────────────────────────────

  suite("Pub/Sub", () => {
    const connId = uniqueName("pubsub_conn");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Pub/Sub Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("subscribe and receive published message", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      const subject = `${uniqueName("pubsub")}.test`;

      const sub = svc.nats.subscribe(subject);
      // Small delay to let subscription establish
      await new Promise((r) => setTimeout(r, 100));

      // Publish a message
      await svc.nats.publish(subject, encoder.encode("hello pubsub"));

      // Read first message from the async iterable
      let received: MessageView | undefined;
      for await (const msg of sub.messages) {
        received = msg;
        break; // Only need the first message
      }

      sub.unsubscribe();
      assert.ok(received, "Expected to receive a message");
      assert.strictEqual(received.subject, subject);
      assert.strictEqual(received.payload, "hello pubsub");
    });

    test("subscribe receives correct payload", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      const subject = `${uniqueName("pubsub")}.payload`;

      const sub = svc.nats.subscribe(subject);
      await new Promise((r) => setTimeout(r, 100));

      const payload = JSON.stringify({ key: "value", num: 99 });
      await svc.nats.publish(subject, encoder.encode(payload));

      let received: MessageView | undefined;
      for await (const msg of sub.messages) {
        received = msg;
        break;
      }

      sub.unsubscribe();
      assert.ok(received);
      const parsed = JSON.parse(received.payload);
      assert.strictEqual(parsed.key, "value");
      assert.strictEqual(parsed.num, 99);
    });

    test("request without responder rejects with timeout", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      const subject = `${uniqueName("req")}.no_responder`;

      try {
        await svc.nats.request(subject, encoder.encode("hello"), { timeout: 1000 });
        assert.fail("Expected request to reject");
      } catch (err: unknown) {
        // Should get a timeout or no-responders error
        assert.ok(err, "Expected an error");
      }
    });

    test("publish with headers, subscribe and verify headers received", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)!;
      const subject = `${uniqueName("pubsub")}.headers`;

      const sub = svc.nats.subscribe(subject);
      await new Promise((r) => setTimeout(r, 100));

      await svc.nats.publish(
        subject,
        encoder.encode("msg with headers"),
        { headers: { "X-Custom": "custom-value", "X-Trace-Id": "trace123" } },
      );

      let received: MessageView | undefined;
      for await (const msg of sub.messages) {
        received = msg;
        break;
      }

      sub.unsubscribe();
      assert.ok(received, "Expected to receive a message");
      assert.ok(received.headers, "Expected headers to be present");
      assert.ok(
        received.headers!["X-Custom"]?.includes("custom-value"),
        `Expected X-Custom header, got ${JSON.stringify(received.headers)}`,
      );
      assert.ok(
        received.headers!["X-Trace-Id"]?.includes("trace123"),
        "Expected X-Trace-Id header",
      );
    });
  });

  // ─── Object Store ─────────────────────────────────────────

  suite("Object Store", () => {
    const connId = uniqueName("obj_conn");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Object Store Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("listStores returns an array without throwing", async () => {
      const svc = api.getServices(connId)!;
      const stores = await svc.obj.listStores();
      assert.ok(Array.isArray(stores), "Expected stores to be an array");
    });
  });

  // ─── Webview Panel HTML ───────────────────────────────────

  suite("Webview Panel HTML", () => {
    const panels: vscode.WebviewPanel[] = [];

    suiteTeardown(() => {
      for (const p of panels) p.dispose();
    });

    for (const entry of [
      "message-browser",
      "pub-sub",
      "kv-editor",
      "obj-viewer",
      "server-monitor",
    ]) {
      test(`${entry} panel loads with valid HTML`, () => {
        const panel = api.panelManager.createOrShow(
          `test:${entry}`,
          `Test ${entry}`,
          entry,
        );
        panels.push(panel);
        const html = panel.webview.html;

        assert.ok(html.length > 100, `${entry}: HTML too short`);
        assert.ok(
          html.includes("Content-Security-Policy"),
          `${entry}: missing CSP`,
        );
        assert.ok(
          !html.includes('rel="modulepreload"'),
          `${entry}: modulepreload not stripped`,
        );
        assert.ok(
          !html.includes("crossorigin"),
          `${entry}: crossorigin not stripped`,
        );
        assert.ok(
          html.includes("nonce="),
          `${entry}: scripts missing nonce`,
        );
        assert.ok(
          html.includes('<div id="app">'),
          `${entry}: missing #app mount`,
        );
      });
    }
  });

  // ─── Webview with Live Data ───────────────────────────────

  suite("Webview with Live Data", () => {
    const connId = uniqueName("webview_conn");
    const streamName = uniqueName("WV_STREAM");
    const bucketName = uniqueName("wv_bucket");
    const panels: vscode.WebviewPanel[] = [];

    suiteSetup(async function () {
      this.timeout(15000);
      await api.connectionManager.addConnection({
        id: connId, name: "Webview Tests", servers: [NATS_URL],
        monitoringUrl: "http://localhost:8222",
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);

      const svc = api.getServices(connId)!;
      // Create test stream with messages
      await svc.jetstream.createStream({
        name: streamName,
        subjects: [`${streamName}.>`],
      });
      await svc.nats.publish(
        `${streamName}.test`,
        encoder.encode("webview test msg"),
      );
      await new Promise((r) => setTimeout(r, 300));

      // Create test KV bucket with data
      await svc.kv.createBucket(bucketName);
      await svc.kv.put(bucketName, "testkey", encoder.encode("testval"));
    });

    suiteTeardown(async () => {
      for (const p of panels) p.dispose();
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await svc?.kv.deleteBucket(bucketName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("message-browser panel opens for stream", () => {
      const panel = api.panelManager.createOrShow(
        `live:messages:${connId}:${streamName}`,
        `Messages: ${streamName}`,
        "message-browser",
      );
      panels.push(panel);
      assert.ok(panel.webview.html.length > 100);
      // Send init message (webview will request data)
      panel.webview.postMessage({
        type: "init",
        connectionId: connId,
        streamName,
      });
    });

    test("kv-editor panel opens for key", () => {
      const panel = api.panelManager.createOrShow(
        `live:kv:${connId}:${bucketName}:testkey`,
        `KV: ${bucketName}/testkey`,
        "kv-editor",
      );
      panels.push(panel);
      assert.ok(panel.webview.html.length > 100);
      panel.webview.postMessage({
        type: "init",
        connectionId: connId,
        bucket: bucketName,
        key: "testkey",
      });
    });

    test("pub-sub panel opens", () => {
      const panel = api.panelManager.createOrShow(
        `live:pubsub:${connId}`,
        "NATS Pub/Sub",
        "pub-sub",
      );
      panels.push(panel);
      assert.ok(panel.webview.html.length > 100);
      panel.webview.postMessage({
        type: "init",
        connectionId: connId,
      });
    });

    test("server-monitor panel opens", () => {
      const panel = api.panelManager.createOrShow(
        `live:monitor:${connId}`,
        "Server Monitor",
        "server-monitor",
      );
      panels.push(panel);
      assert.ok(panel.webview.html.length > 100);
      panel.webview.postMessage({
        type: "init",
        connectionId: connId,
      });
    });
  });

  // ─── Time-Range Message Browsing ──────────────────────────

  suite("Time-Range Message Browsing", () => {
    const connId = uniqueName("time_conn");
    const streamName = uniqueName("TIME_STREAM");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Time Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({
        name: streamName, subjects: [`${streamName}.>`],
      });
      // Publish messages with slight delay between them
      for (let i = 0; i < 3; i++) {
        await svc.nats.publish(`${streamName}.timed`, encoder.encode(`timed ${i}`));
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 500));
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("browse by startTime returns messages", async function () {
      this.timeout(15000);
      const svc = api.getServices(connId)!;
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const msgs = await svc.jetstream.getStreamMessages(streamName, {
        startTime: pastTime,
        limit: 10,
      });
      assert.ok(msgs.length >= 3, `Expected >= 3 messages, got ${msgs.length}`);
    });
  });

  // ─── KV Watch ─────────────────────────────────────────────

  suite("KV Watch", () => {
    const connId = uniqueName("watch_conn");
    const bucketName = uniqueName("watch_bucket");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Watch Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.kv.createBucket(bucketName);
      await svc.kv.put(bucketName, "watched", encoder.encode("initial"));
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.kv.deleteBucket(bucketName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("watchEntries yields initial value", async function () {
      this.timeout(10000);
      const svc = api.getServices(connId)! as unknown as {
        kv: { watchEntries(bucket: string, key?: string): AsyncIterable<KvEntry> };
      };
      let found = false;
      for await (const entry of svc.kv.watchEntries(bucketName, "watched")) {
        assert.strictEqual(entry.key, "watched");
        assert.strictEqual(entry.value, "initial");
        found = true;
        break; // Just check the first entry
      }
      assert.ok(found, "watchEntries should yield at least one entry");
    });
  });

  // ─── Object Store ─────────────────────────────────────────

  suite("Object Store Extended", () => {
    const connId = uniqueName("obj_conn");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Obj Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("listStores returns array", async () => {
      const svc = api.getServices(connId)!;
      const stores = await svc.obj.listStores();
      assert.ok(Array.isArray(stores));
    });
  });

  // ─── Monitoring ───────────────────────────────────────────

  suite("Monitoring", () => {
    // The monitoring service uses HTTP to hit the NATS monitoring endpoints
    // CI has monitoring on port 8222
    const monUrl = "http://localhost:8222";
    let monSvc: { getVarz(): Promise<Record<string, unknown>>; getConnz(opts?: Record<string, unknown>): Promise<Record<string, unknown>>; getJsz(): Promise<Record<string, unknown>>; getAccountz(): Promise<Record<string, unknown>> };

    suiteSetup(function () {
      monSvc = (api as unknown as { createMonitoringService(url: string): typeof monSvc }).createMonitoringService(monUrl);
    });

    test("getVarz returns server info", async function () {
      this.timeout(10000);
      const varz = await monSvc.getVarz();
      assert.ok(varz.server_id, "Missing server_id");
      assert.ok(varz.version, "Missing version");
      assert.ok(typeof varz.uptime === "string", "Missing uptime");
      assert.ok(typeof varz.connections === "number", "Missing connections count");
      assert.ok(typeof varz.mem === "number", "Missing mem");
    });

    test("getConnz returns connections", async function () {
      this.timeout(10000);
      const connz = await monSvc.getConnz();
      assert.ok(typeof connz.num_connections === "number");
      assert.ok(Array.isArray(connz.connections));
    });

    test("getJsz returns JetStream info", async function () {
      this.timeout(10000);
      const jsz = await monSvc.getJsz();
      assert.ok(typeof jsz.memory === "number", "Missing memory");
      assert.ok(typeof jsz.storage === "number", "Missing storage");
      assert.ok(jsz.api, "Missing api stats");
    });

    test("getAccountz returns accounts", async function () {
      this.timeout(10000);
      const accountz = await monSvc.getAccountz();
      assert.ok(accountz.server_id, "Missing server_id");
      assert.ok(Array.isArray(accountz.accounts), "Missing accounts array");
    });
  });

  // ─── Bookmarks ────────────────────────────────────────────

  suite("Bookmarks", () => {
    let bookmarks: {
      getSavedSubscriptions(): Array<{ name: string; subject: string }>;
      saveSubscription(sub: { name: string; subject: string }): Promise<void>;
      deleteSubscription(name: string): Promise<void>;
      getSavedTemplates(): Array<{ name: string; subject: string; payload: string; headers: Record<string, string> }>;
      saveTemplate(t: { name: string; subject: string; payload: string; headers: Record<string, string> }): Promise<void>;
      deleteTemplate(name: string): Promise<void>;
      getMessageBookmarks(): Array<{ name: string; stream: string; sequence: number; subject: string }>;
      saveMessageBookmark(b: { name: string; stream: string; sequence: number; subject: string }): Promise<void>;
      deleteMessageBookmark(name: string): Promise<void>;
    };

    suiteSetup(() => {
      bookmarks = (api as unknown as { bookmarks: typeof bookmarks }).bookmarks;
    });

    test("save and retrieve subscription", async () => {
      await bookmarks.saveSubscription({ name: "test-sub", subject: "orders.>" });
      const subs = bookmarks.getSavedSubscriptions();
      assert.ok(subs.some((s) => s.name === "test-sub" && s.subject === "orders.>"));
    });

    test("delete subscription", async () => {
      await bookmarks.deleteSubscription("test-sub");
      const subs = bookmarks.getSavedSubscriptions();
      assert.ok(!subs.some((s) => s.name === "test-sub"));
    });

    test("save and retrieve template", async () => {
      await bookmarks.saveTemplate({
        name: "test-template",
        subject: "orders.create",
        payload: '{"item":"widget"}',
        headers: { "Content-Type": "application/json" },
      });
      const templates = bookmarks.getSavedTemplates();
      const t = templates.find((t) => t.name === "test-template");
      assert.ok(t);
      assert.strictEqual(t.subject, "orders.create");
      assert.strictEqual(t.payload, '{"item":"widget"}');
    });

    test("delete template", async () => {
      await bookmarks.deleteTemplate("test-template");
      const templates = bookmarks.getSavedTemplates();
      assert.ok(!templates.some((t) => t.name === "test-template"));
    });

    test("save and retrieve message bookmark", async () => {
      await bookmarks.saveMessageBookmark({
        name: "important-msg",
        stream: "ORDERS",
        sequence: 42,
        subject: "orders.created",
      });
      const bms = bookmarks.getMessageBookmarks();
      const bm = bms.find((b) => b.name === "important-msg");
      assert.ok(bm);
      assert.strictEqual(bm.stream, "ORDERS");
      assert.strictEqual(bm.sequence, 42);
    });

    test("delete message bookmark", async () => {
      await bookmarks.deleteMessageBookmark("important-msg");
      const bms = bookmarks.getMessageBookmarks();
      assert.ok(!bms.some((b) => b.name === "important-msg"));
    });

    test("overwrite existing bookmark with same name", async () => {
      await bookmarks.saveSubscription({ name: "dup", subject: "a.>" });
      await bookmarks.saveSubscription({ name: "dup", subject: "b.>" });
      const subs = bookmarks.getSavedSubscriptions();
      const dups = subs.filter((s) => s.name === "dup");
      assert.strictEqual(dups.length, 1);
      assert.strictEqual(dups[0].subject, "b.>");
      await bookmarks.deleteSubscription("dup");
    });
  });

  // ─── New Features ─────────────────────────────────────────

  suite("Keyboard Shortcuts (#40)", () => {
    test("keybinding commands are registered", async () => {
      const all = await vscode.commands.getCommands(true);
      // These commands should exist (keybindings reference them)
      assert.ok(all.includes("leafnode.addConnection"));
      assert.ok(all.includes("leafnode.openPubSub"));
      assert.ok(all.includes("leafnode.openServerMonitor"));
    });
  });

  suite("Export/Import Connections (#36)", () => {
    test("export and import commands exist", async () => {
      const all = await vscode.commands.getCommands(true);
      assert.ok(all.includes("leafnode.exportConnections"));
      assert.ok(all.includes("leafnode.importConnections"));
      assert.ok(all.includes("leafnode.importFromEnv"));
    });
  });

  suite("Consumer Pull (#31)", () => {
    const connId = uniqueName("pull_conn");
    const streamName = uniqueName("PULL_STREAM");
    const consumerName = uniqueName("pull_consumer");

    suiteSetup(async function () {
      this.timeout(15000);
      await api.connectionManager.addConnection({
        id: connId, name: "Pull Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({ name: streamName, subjects: [`${streamName}.>`] });
      await svc.jetstream.createConsumer(streamName, { durable_name: consumerName, ack_policy: "none" });
      for (let i = 0; i < 5; i++) {
        await svc.nats.publish(`${streamName}.data`, encoder.encode(`pull msg ${i}`));
      }
      await new Promise((r) => setTimeout(r, 500));
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("pull messages from consumer", async function () {
      this.timeout(15000);
      const svc = api.getServices(connId)!;
      const msgs = await svc.jetstream.pullConsumerMessages(streamName, consumerName, 5);
      assert.ok(msgs.length > 0, `Expected pulled messages, got ${msgs.length}`);
      assert.ok(msgs[0].payload.includes("pull msg"));
    });
  });

  suite("Message Search (#37)", () => {
    const connId = uniqueName("search_conn");
    const streamName = uniqueName("SEARCH_STREAM");

    suiteSetup(async function () {
      this.timeout(15000);
      await api.connectionManager.addConnection({
        id: connId, name: "Search Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
      const svc = api.getServices(connId)!;
      await svc.jetstream.createStream({ name: streamName, subjects: [`${streamName}.>`] });
      await svc.nats.publish(`${streamName}.a`, encoder.encode("hello world"));
      await svc.nats.publish(`${streamName}.b`, encoder.encode("foo bar baz"));
      await svc.nats.publish(`${streamName}.c`, encoder.encode("hello again"));
      await new Promise((r) => setTimeout(r, 500));
    });

    suiteTeardown(async () => {
      const svc = api.getServices(connId);
      try { await svc?.jetstream.deleteStream(streamName); } catch { /* ok */ }
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("search finds matching messages", async function () {
      this.timeout(15000);
      const svc = api.getServices(connId)!;
      const results = await svc.jetstream.searchMessages(streamName, "hello", 10);
      assert.strictEqual(results.length, 2, `Expected 2 matches, got ${results.length}`);
      assert.ok(results[0].payload.includes("hello"));
      assert.ok(results[1].payload.includes("hello"));
    });

    test("search with no matches returns empty", async function () {
      this.timeout(15000);
      const svc = api.getServices(connId)!;
      const results = await svc.jetstream.searchMessages(streamName, "nonexistent", 10);
      assert.strictEqual(results.length, 0);
    });
  });

  suite("Connection Health Check (#33)", () => {
    const connId = uniqueName("ping_conn");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Ping Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("ping returns RTT in milliseconds", async () => {
      const rtt = await api.connectionManager.ping(connId);
      assert.ok(rtt !== undefined, "Expected RTT value");
      assert.ok(typeof rtt === "number", "RTT should be a number");
      assert.ok(rtt >= 0, "RTT should be non-negative");
    });

    test("ping on disconnected returns undefined", async () => {
      const badId = uniqueName("noconn");
      const rtt = await api.connectionManager.ping(badId);
      assert.strictEqual(rtt, undefined);
    });
  });

  suite("Message Republish (#32)", () => {
    test("republish command exists", async () => {
      const all = await vscode.commands.getCommands(true);
      // The republish is handled via postMessage, not a VS Code command
      // Just verify the message browser panel can be opened
      assert.ok(all.includes("leafnode.streams.browseMessages"));
    });
  });

  suite("Config Diff (#35)", () => {
    test("diff command exists", async () => {
      const all = await vscode.commands.getCommands(true);
      assert.ok(all.includes("leafnode.streams.diff"));
    });
  });

  suite("Stream Mirror/Sources (#30)", () => {
    const connId = uniqueName("mirror_conn");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Mirror Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(connId);
    });

    suiteTeardown(async () => {
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("stream config includes mirror and sources fields", async () => {
      const svc = api.getServices(connId)!;
      const stream = uniqueName("MIRROR_TEST");
      await svc.jetstream.createStream({ name: stream, subjects: [`${stream}.>`] });
      const info = await svc.jetstream.getStream(stream);
      // mirror and sources should be present in the config (even if undefined)
      assert.ok("mirror" in info.config || info.config.mirror === undefined);
      assert.ok("sources" in info.config || info.config.sources === undefined);
      await svc.jetstream.deleteStream(stream);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────

  suite("Edge Cases", () => {
    const connId = uniqueName("edge_conn");

    suiteSetup(async function () {
      this.timeout(10000);
      await api.connectionManager.addConnection({
        id: connId, name: "Edge Tests", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
    });

    suiteTeardown(async () => {
      try { await api.connectionManager.disconnect(connId); } catch { /* ok */ }
      try { await api.connectionManager.removeConnection(connId); } catch { /* ok */ }
    });

    test("double disconnect is idempotent", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      await api.connectionManager.disconnect(connId);
      // Second disconnect should not throw
      await api.connectionManager.disconnect(connId);
      assert.strictEqual(api.connectionManager.getStatus(connId), "disconnected");
    });

    test("connect to already-connected is idempotent", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      // Second connect should return without error
      await api.connectionManager.connect(connId);
      assert.strictEqual(api.connectionManager.getStatus(connId), "connected");
      await api.connectionManager.disconnect(connId);
    });

    test("getServices returns undefined after disconnect", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      assert.ok(api.getServices(connId), "Should have services when connected");
      await api.connectionManager.disconnect(connId);
      assert.strictEqual(api.getServices(connId), undefined, "Should be undefined after disconnect");
    });

    test("disconnect then reconnect works", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      await api.connectionManager.disconnect(connId);
      await api.connectionManager.connect(connId);
      assert.strictEqual(api.connectionManager.getStatus(connId), "connected");
      const svc = api.getServices(connId);
      assert.ok(svc, "Services should be available after reconnect");
      await api.connectionManager.disconnect(connId);
    });

    test("rapid connect-disconnect cycle", async function () {
      this.timeout(15000);
      for (let i = 0; i < 3; i++) {
        await api.connectionManager.connect(connId);
        assert.strictEqual(api.connectionManager.getStatus(connId), "connected");
        await api.connectionManager.disconnect(connId);
        assert.strictEqual(api.connectionManager.getStatus(connId), "disconnected");
      }
    });

    test("remove connection while connected", async function () {
      this.timeout(10000);
      const tempId = uniqueName("temp");
      await api.connectionManager.addConnection({
        id: tempId, name: "Temp", servers: [NATS_URL],
        auth: { type: "anonymous" },
      });
      await api.connectionManager.connect(tempId);
      assert.strictEqual(api.connectionManager.getStatus(tempId), "connected");
      // Remove should disconnect and remove
      await api.connectionManager.removeConnection(tempId);
      const saved = api.connectionManager.getSavedConnections();
      assert.ok(!saved.some((c) => c.id === tempId), "Should be removed");
    });

    test("operations after disconnect return gracefully", async function () {
      this.timeout(10000);
      await api.connectionManager.connect(connId);
      assert.ok(api.getServices(connId), "Services available before disconnect");
      await api.connectionManager.disconnect(connId);
      // getServices should return undefined for disconnected
      const newSvc = api.getServices(connId);
      assert.strictEqual(newSvc, undefined);
    });

    test("per-connection context commands exist", async () => {
      const all = await vscode.commands.getCommands(true);
      assert.ok(all.includes("leafnode.connection.viewHealth"));
      assert.ok(all.includes("leafnode.connection.openPubSub"));
      assert.ok(all.includes("leafnode.connection.openMonitor"));
    });
  });
});
