const textDecoder = new TextDecoder("utf-8", { fatal: true });

export function tryDecodeUtf8(data: Uint8Array): string | null {
  try {
    return textDecoder.decode(data);
  } catch {
    return null;
  }
}

export function tryParseJson(
  data: Uint8Array,
): { parsed: unknown; text: string } | null {
  const text = tryDecodeUtf8(data);
  if (text === null) return null;
  try {
    return { parsed: JSON.parse(text), text };
  } catch {
    return null;
  }
}

export function toDisplayString(data: Uint8Array): {
  text: string;
  encoding: "utf8" | "base64";
} {
  const utf8 = tryDecodeUtf8(data);
  if (utf8 !== null) {
    return { text: utf8, encoding: "utf8" };
  }
  return { text: uint8ArrayToBase64(data), encoding: "base64" };
}

function uint8ArrayToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

export function prettyJson(data: Uint8Array): string | null {
  const result = tryParseJson(data);
  if (result === null) return null;
  return JSON.stringify(result.parsed, null, 2);
}
