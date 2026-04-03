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
    }): Promise<StreamInfo>;
    deleteStream(name: string): Promise<void>;
    purgeStream(name: string): Promise<void>;
    getStreamMessages(
      stream: string,
      opts: { startSeq?: number; limit: number; subject?: string },
    ): Promise<MessageView[]>;
    listConsumers(stream: string): Promise<ConsumerInfo[]>;
    createConsumer(
      stream: string,
      config: Record<string, unknown>,
    ): Promise<ConsumerInfo>;
    deleteConsumer(stream: string, name: string): Promise<void>;
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
    ): Promise<void>;
  };
}

interface StreamInfo {
  name: string;
  config: { subjects: string[] };
  state: { messages: number };
}
interface MessageView {
  subject: string;
  payload: string;
  sequence?: number;
}
interface ConsumerInfo {
  name: string;
  numPending: number;
}
interface BucketInfo {
  bucket: string;
}
interface KvEntry {
  key: string;
  value: string;
  revision: number;
  operation: string;
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
});
