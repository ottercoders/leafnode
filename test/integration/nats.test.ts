import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getConnection, cleanup } from "./setup";
import { NatsService } from "../../src/services/nats";
import type { NatsConnection } from "@nats-io/transport-node";

describe("NatsService", () => {
  let nc: NatsConnection;
  let svc: NatsService;

  beforeAll(async () => {
    nc = await getConnection();
    svc = new NatsService(nc);
  });

  afterAll(async () => {
    await cleanup();
  });

  it("should publish and subscribe", async () => {
    const subject = `test.pubsub.${Date.now()}`;
    const sub = svc.subscribe(subject);

    // Publish after a short delay
    setTimeout(() => {
      svc.publish(subject, new TextEncoder().encode("hello pubsub"));
    }, 50);

    // Read first message
    for await (const msg of sub.messages) {
      expect(msg.subject).toBe(subject);
      expect(msg.payload).toBe("hello pubsub");
      break;
    }

    sub.unsubscribe();
  });

  it("should handle request/reply", async () => {
    const subject = `test.reqrep.${Date.now()}`;

    // Set up responder
    const responderSub = nc.subscribe(subject);
    (async () => {
      for await (const msg of responderSub) {
        if (msg.reply) {
          nc.publish(msg.reply, new TextEncoder().encode("pong"));
        }
      }
    })();

    const response = await svc.request(
      subject,
      new TextEncoder().encode("ping"),
      { timeout: 5000 },
    );
    expect(response.payload).toBe("pong");

    responderSub.unsubscribe();
  });

  it("should publish with headers", async () => {
    const subject = `test.headers.${Date.now()}`;
    const sub = svc.subscribe(subject);

    setTimeout(() => {
      svc.publish(subject, new TextEncoder().encode("with headers"), {
        headers: { "X-Custom": "value" },
      });
    }, 50);

    for await (const msg of sub.messages) {
      expect(msg.headers).toBeDefined();
      expect(msg.headers!["X-Custom"]).toContain("value");
      break;
    }

    sub.unsubscribe();
  });
});
