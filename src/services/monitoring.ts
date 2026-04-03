import * as http from "http";
import * as https from "https";
import type {
  VarzResponse,
  ConnzResponse,
  JszResponse,
  AccountzResponse,
} from "../types/monitoring";

const REQUEST_TIMEOUT = 5000;

async function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(
          new Error(
            `HTTP ${res.statusCode} from ${url}`,
          ),
        );
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e}`));
        }
      });
    });
    req.on("error", (e) =>
      reject(new Error(`Request failed for ${url}: ${e.message}`)),
    );
    req.setTimeout(REQUEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error(`Request timed out after ${REQUEST_TIMEOUT}ms: ${url}`));
    });
  });
}

export class MonitoringService {
  constructor(private monitoringUrl: string) {}

  async getVarz(): Promise<VarzResponse> {
    return fetchJson<VarzResponse>(`${this.monitoringUrl}/varz`);
  }

  async getConnz(opts?: {
    limit?: number;
    sort?: string;
  }): Promise<ConnzResponse> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.sort) params.set("sort", opts.sort);
    const qs = params.toString();
    return fetchJson<ConnzResponse>(
      `${this.monitoringUrl}/connz${qs ? `?${qs}` : ""}`,
    );
  }

  async getJsz(): Promise<JszResponse> {
    return fetchJson<JszResponse>(`${this.monitoringUrl}/jsz`);
  }

  async getAccountz(): Promise<AccountzResponse> {
    return fetchJson<AccountzResponse>(`${this.monitoringUrl}/accountz`);
  }
}
