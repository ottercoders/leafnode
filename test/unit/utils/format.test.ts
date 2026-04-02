import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatCount,
  formatDuration,
  formatTimestamp,
} from "../../../src/utils/format";

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("formats terabytes", () => {
    expect(formatBytes(1024 ** 4)).toBe("1.0 TB");
  });
});

describe("formatCount", () => {
  it("formats small numbers", () => {
    expect(formatCount(42)).toBe("42");
    expect(formatCount(999)).toBe("999");
  });

  it("formats thousands", () => {
    expect(formatCount(1000)).toBe("1.0K");
    expect(formatCount(52341)).toBe("52.3K");
  });

  it("formats millions", () => {
    expect(formatCount(1_204_556)).toBe("1.2M");
  });

  it("formats billions", () => {
    expect(formatCount(2_500_000_000)).toBe("2.5B");
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(50)).toBe("50ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(5500)).toBe("5.5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
  });

  it("formats hours", () => {
    expect(formatDuration(3_661_000)).toBe("1h 1m");
  });
});

describe("formatTimestamp", () => {
  it("formats ISO string", () => {
    const result = formatTimestamp("2026-04-02T12:30:00.000Z");
    expect(result).toBe("2026-04-02 12:30:00.000");
  });

  it("formats Date object", () => {
    const result = formatTimestamp(new Date("2026-01-01T00:00:00Z"));
    expect(result).toBe("2026-01-01 00:00:00.000");
  });
});
