import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getConnection, cleanup, uniqueName } from "./setup";
import { KvService } from "../../src/services/kv";
import type { NatsConnection } from "@nats-io/transport-node";

describe("KvService", () => {
  let nc: NatsConnection;
  let svc: KvService;
  const bucketName = uniqueName("test_bucket");

  beforeAll(async () => {
    nc = await getConnection();
    svc = new KvService(nc);
  });

  afterAll(async () => {
    try {
      await svc.deleteBucket(bucketName);
    } catch {
      // may not exist
    }
    await cleanup();
  });

  it("should create a bucket", async () => {
    await svc.createBucket(bucketName);
    const buckets = await svc.listBuckets();
    const found = buckets.find((b) => b.bucket === bucketName);
    expect(found).toBeDefined();
  });

  it("should put and get a key", async () => {
    const revision = await svc.put(
      bucketName,
      "testKey",
      new TextEncoder().encode("testValue"),
    );
    expect(revision).toBeGreaterThan(0);

    const entry = await svc.get(bucketName, "testKey");
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("testKey");
    expect(entry!.value).toBe("testValue");
    expect(entry!.valueEncoding).toBe("utf8");
  });

  it("should list keys", async () => {
    await svc.put(
      bucketName,
      "anotherKey",
      new TextEncoder().encode("anotherValue"),
    );
    const keys = await svc.getKeys(bucketName);
    expect(keys).toContain("testKey");
    expect(keys).toContain("anotherKey");
  });

  it("should get key history", async () => {
    // Update testKey to create history
    await svc.put(
      bucketName,
      "testKey",
      new TextEncoder().encode("updatedValue"),
    );
    const history = await svc.history(bucketName, "testKey");
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].value).toBe("testValue");
    expect(history[1].value).toBe("updatedValue");
  });

  it("should delete a key", async () => {
    await svc.delete(bucketName, "anotherKey");
    const entry = await svc.get(bucketName, "anotherKey");
    // After delete, the entry exists but has operation DEL
    expect(entry?.operation).toBe("DEL");
  });

  it("should return null for non-existent key", async () => {
    const entry = await svc.get(bucketName, "nonexistent");
    expect(entry).toBeNull();
  });

  it("should delete bucket", async () => {
    await svc.deleteBucket(bucketName);
    const buckets = await svc.listBuckets();
    expect(buckets.find((b) => b.bucket === bucketName)).toBeUndefined();
  });
});
