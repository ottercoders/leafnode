import { describe, it, expect } from "vitest";
import {
  parseSubjectTokens,
  subjectMatchesFilter,
} from "../../../src/utils/subject";

describe("parseSubjectTokens", () => {
  it("splits simple subject", () => {
    expect(parseSubjectTokens("ORDERS.created")).toEqual([
      "ORDERS",
      "created",
    ]);
  });

  it("handles single token", () => {
    expect(parseSubjectTokens("ORDERS")).toEqual(["ORDERS"]);
  });

  it("handles deep subjects", () => {
    expect(parseSubjectTokens("a.b.c.d.e")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });
});

describe("subjectMatchesFilter", () => {
  it("matches exact subject", () => {
    expect(subjectMatchesFilter("ORDERS.created", "ORDERS.created")).toBe(true);
  });

  it("rejects non-matching exact subject", () => {
    expect(subjectMatchesFilter("ORDERS.created", "ORDERS.updated")).toBe(
      false,
    );
  });

  it("matches single wildcard *", () => {
    expect(subjectMatchesFilter("ORDERS.created", "ORDERS.*")).toBe(true);
    expect(subjectMatchesFilter("ORDERS.updated", "ORDERS.*")).toBe(true);
  });

  it("rejects * for multiple tokens", () => {
    expect(subjectMatchesFilter("ORDERS.us.created", "ORDERS.*")).toBe(false);
  });

  it("matches > wildcard for one token", () => {
    expect(subjectMatchesFilter("ORDERS.created", "ORDERS.>")).toBe(true);
  });

  it("matches > wildcard for multiple tokens", () => {
    expect(subjectMatchesFilter("ORDERS.us.created", "ORDERS.>")).toBe(true);
  });

  it("rejects > with no remaining tokens", () => {
    expect(subjectMatchesFilter("ORDERS", "ORDERS.>")).toBe(false);
  });

  it("matches bare >", () => {
    expect(subjectMatchesFilter("anything", ">")).toBe(true);
    expect(subjectMatchesFilter("a.b.c", ">")).toBe(true);
  });

  it("handles mixed wildcards", () => {
    expect(subjectMatchesFilter("ORDERS.us.created", "ORDERS.*.created")).toBe(
      true,
    );
    expect(subjectMatchesFilter("ORDERS.eu.created", "ORDERS.*.created")).toBe(
      true,
    );
    expect(subjectMatchesFilter("ORDERS.eu.updated", "ORDERS.*.created")).toBe(
      false,
    );
  });

  it("rejects shorter subject than filter", () => {
    expect(subjectMatchesFilter("ORDERS", "ORDERS.created")).toBe(false);
  });

  it("rejects longer subject than filter without >", () => {
    expect(subjectMatchesFilter("ORDERS.created.extra", "ORDERS.created")).toBe(
      false,
    );
  });
});
