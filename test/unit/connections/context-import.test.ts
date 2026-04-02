import { describe, it, expect } from "vitest";
import { contextToConnectionConfig } from "../../../src/connections/context-import";

describe("contextToConnectionConfig", () => {
  it("handles anonymous context", () => {
    const { config, secrets } = contextToConnectionConfig("local", {
      url: "nats://localhost:4222",
    });
    expect(config.name).toBe("local");
    expect(config.servers).toEqual(["nats://localhost:4222"]);
    expect(config.auth.type).toBe("anonymous");
    expect(Object.keys(secrets)).toHaveLength(0);
  });

  it("handles token auth", () => {
    const { config, secrets } = contextToConnectionConfig("prod", {
      url: "nats://prod:4222",
      token: "my-secret-token",
    });
    expect(config.auth.type).toBe("token");
    expect(secrets.token).toBe("my-secret-token");
  });

  it("handles user/password auth", () => {
    const { config, secrets } = contextToConnectionConfig("staging", {
      url: "nats://staging:4222",
      user: "admin",
      password: "pass123",
    });
    expect(config.auth.type).toBe("userpass");
    if (config.auth.type === "userpass") {
      expect(config.auth.user).toBe("admin");
    }
    expect(secrets.password).toBe("pass123");
  });

  it("handles credentials file", () => {
    const { config, secrets } = contextToConnectionConfig("creds", {
      url: "nats://secure:4222",
      creds: "/path/to/user.creds",
    });
    expect(config.auth.type).toBe("credentials");
    expect(secrets.credsPath).toBe("/path/to/user.creds");
  });

  it("handles nkey", () => {
    const { config, secrets } = contextToConnectionConfig("nkey", {
      url: "nats://secure:4222",
      nkey: "/path/to/user.nk",
    });
    expect(config.auth.type).toBe("nkey");
    expect(secrets.nkeyPath).toBe("/path/to/user.nk");
  });

  it("handles TLS cert auth", () => {
    const { config } = contextToConnectionConfig("tls", {
      url: "nats://tls:4222",
      cert: "/path/to/cert.pem",
      key: "/path/to/key.pem",
      ca: "/path/to/ca.pem",
    });
    expect(config.auth.type).toBe("tls");
    if (config.auth.type === "tls") {
      expect(config.auth.certPath).toBe("/path/to/cert.pem");
      expect(config.auth.keyPath).toBe("/path/to/key.pem");
      expect(config.auth.caPath).toBe("/path/to/ca.pem");
    }
  });

  it("defaults servers to localhost when no url", () => {
    const { config } = contextToConnectionConfig("default", {});
    expect(config.servers).toEqual(["nats://localhost:4222"]);
  });

  it("generates unique ids", () => {
    const { config: c1 } = contextToConnectionConfig("a", {});
    const { config: c2 } = contextToConnectionConfig("b", {});
    expect(c1.id).not.toBe(c2.id);
  });

  it("prioritizes creds over other auth", () => {
    const { config } = contextToConnectionConfig("multi", {
      creds: "/path/to/user.creds",
      token: "some-token",
      user: "admin",
      password: "pass",
    });
    expect(config.auth.type).toBe("credentials");
  });
});
