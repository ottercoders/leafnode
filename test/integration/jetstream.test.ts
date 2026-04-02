import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getConnection, cleanup, uniqueName } from "./setup";
import { JetStreamService } from "../../src/services/jetstream";
import type { NatsConnection } from "@nats-io/transport-node";

describe("JetStreamService", () => {
  let nc: NatsConnection;
  let svc: JetStreamService;
  const streamName = uniqueName("TEST_STREAM");

  beforeAll(async () => {
    nc = await getConnection();
    svc = new JetStreamService(nc);
  });

  afterAll(async () => {
    try {
      await svc.deleteStream(streamName);
    } catch {
      // may not exist
    }
    await cleanup();
  });

  it("should list streams (initially may be empty)", async () => {
    const streams = await svc.listStreams();
    expect(Array.isArray(streams)).toBe(true);
  });

  it("should handle stream operations after creating via jsm", async () => {
    // Create stream directly via NATS API for test setup
    const { jetstreamManager } = await import("@nats-io/jetstream");
    const jsm = await jetstreamManager(nc);
    await jsm.streams.add({
      name: streamName,
      subjects: [`${streamName}.>`],
    });

    // List should include our stream
    const streams = await svc.listStreams();
    const found = streams.find((s) => s.name === streamName);
    expect(found).toBeDefined();
    expect(found!.state.messages).toBe(0);
  });

  it("should get stream info", async () => {
    const info = await svc.getStream(streamName);
    expect(info.name).toBe(streamName);
    expect(info.config.subjects).toContain(`${streamName}.>`);
  });

  it("should browse messages after publishing", async () => {
    // Publish some messages
    const encoder = new TextEncoder();
    for (let i = 0; i < 5; i++) {
      nc.publish(`${streamName}.test`, encoder.encode(`message ${i}`));
    }
    await nc.flush();

    // Wait briefly for stream to process
    await new Promise((r) => setTimeout(r, 200));

    const messages = await svc.getStreamMessages(streamName, {
      startSeq: 1,
      limit: 10,
    });
    expect(messages.length).toBe(5);
    expect(messages[0].subject).toBe(`${streamName}.test`);
    expect(messages[0].payload).toBe("message 0");
    expect(messages[0].sequence).toBe(1);
  });

  it("should filter messages by subject", async () => {
    // Publish to a different subject
    nc.publish(
      `${streamName}.other`,
      new TextEncoder().encode("other message"),
    );
    await nc.flush();
    await new Promise((r) => setTimeout(r, 200));

    const messages = await svc.getStreamMessages(streamName, {
      startSeq: 1,
      subject: `${streamName}.other`,
      limit: 10,
    });
    expect(messages.length).toBe(1);
    expect(messages[0].payload).toBe("other message");
  });

  it("should list consumers", async () => {
    const consumers = await svc.listConsumers(streamName);
    expect(Array.isArray(consumers)).toBe(true);
  });

  it("should purge stream", async () => {
    await svc.purgeStream(streamName);
    const info = await svc.getStream(streamName);
    expect(info.state.messages).toBe(0);
  });

  it("should delete stream", async () => {
    await svc.deleteStream(streamName);
    const streams = await svc.listStreams();
    expect(streams.find((s) => s.name === streamName)).toBeUndefined();
  });
});
