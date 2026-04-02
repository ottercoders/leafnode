import { describe, it, expect } from "vitest";
import {
  tryDecodeUtf8,
  tryParseJson,
  toDisplayString,
  prettyJson,
} from "../../../src/utils/codec";

describe("tryDecodeUtf8", () => {
  it("decodes valid UTF-8", () => {
    const data = new TextEncoder().encode("hello world");
    expect(tryDecodeUtf8(data)).toBe("hello world");
  });

  it("returns null for invalid UTF-8", () => {
    const data = new Uint8Array([0xff, 0xfe, 0x80]);
    expect(tryDecodeUtf8(data)).toBeNull();
  });

  it("handles empty input", () => {
    expect(tryDecodeUtf8(new Uint8Array())).toBe("");
  });

  it("handles unicode", () => {
    const data = new TextEncoder().encode("hello 🌍");
    expect(tryDecodeUtf8(data)).toBe("hello 🌍");
  });
});

describe("tryParseJson", () => {
  it("parses valid JSON", () => {
    const data = new TextEncoder().encode('{"key": "value"}');
    const result = tryParseJson(data);
    expect(result).not.toBeNull();
    expect(result!.parsed).toEqual({ key: "value" });
    expect(result!.text).toBe('{"key": "value"}');
  });

  it("returns null for invalid JSON text", () => {
    const data = new TextEncoder().encode("not json");
    expect(tryParseJson(data)).toBeNull();
  });

  it("returns null for binary data", () => {
    const data = new Uint8Array([0xff, 0xfe]);
    expect(tryParseJson(data)).toBeNull();
  });

  it("parses JSON arrays", () => {
    const data = new TextEncoder().encode("[1, 2, 3]");
    const result = tryParseJson(data);
    expect(result!.parsed).toEqual([1, 2, 3]);
  });
});

describe("toDisplayString", () => {
  it("returns utf8 for text data", () => {
    const data = new TextEncoder().encode("hello");
    const result = toDisplayString(data);
    expect(result.text).toBe("hello");
    expect(result.encoding).toBe("utf8");
  });

  it("returns base64 for binary data", () => {
    const data = new Uint8Array([0xff, 0xfe, 0x80]);
    const result = toDisplayString(data);
    expect(result.encoding).toBe("base64");
    expect(result.text).toBe(Buffer.from(data).toString("base64"));
  });
});

describe("prettyJson", () => {
  it("pretty-prints JSON", () => {
    const data = new TextEncoder().encode('{"a":1}');
    const result = prettyJson(data);
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it("returns null for non-JSON", () => {
    const data = new TextEncoder().encode("plain text");
    expect(prettyJson(data)).toBeNull();
  });
});
