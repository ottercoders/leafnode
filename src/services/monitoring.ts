import * as http from "http";
import * as https from "https";
import type {
  VarzResponse,
  ConnzResponse,
  JszResponse,
  AccountzResponse,
} from "../types/monitoring";

async function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
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
