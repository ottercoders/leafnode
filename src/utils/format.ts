const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sign = bytes < 0 ? "-" : "";
  let abs = Math.abs(bytes);
  let unitIndex = 0;
  while (abs >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    abs /= 1024;
    unitIndex++;
  }
  const value = unitIndex === 0 ? abs : abs.toFixed(1);
  return `${sign}${value} ${BYTE_UNITS[unitIndex]}`;
}

export function formatCount(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatNanos(nanos: number | bigint | string): string {
  const ms =
    typeof nanos === "bigint"
      ? Number(nanos / 1_000_000n)
      : Number(nanos) / 1_000_000;
  return formatDuration(ms);
}

export function formatTimestamp(
  ts: string | Date | number,
): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  return date.toISOString().replace("T", " ").replace("Z", "");
}
