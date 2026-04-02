export interface VarzResponse {
  server_id: string;
  server_name: string;
  version: string;
  go: string;
  host: string;
  port: number;
  max_connections: number;
  connections: number;
  total_connections: number;
  uptime: string;
  mem: number;
  cores: number;
  cpu: number;
  in_msgs: number;
  out_msgs: number;
  in_bytes: number;
  out_bytes: number;
  subscriptions: number;
  slow_consumers: number;
}

export interface ConnzResponse {
  num_connections: number;
  total: number;
  offset: number;
  limit: number;
  connections: ConnectionInfo[];
}

export interface ConnectionInfo {
  cid: number;
  ip: string;
  port: number;
  name: string;
  lang: string;
  version: string;
  rtt: string;
  uptime: string;
  in_msgs: number;
  out_msgs: number;
  in_bytes: number;
  out_bytes: number;
  subscriptions: number;
  pending_bytes: number;
}

export interface JszResponse {
  server_id: string;
  now: string;
  config?: {
    max_memory: number;
    max_store: number;
    store_dir: string;
  };
  memory: number;
  storage: number;
  api: {
    total: number;
    errors: number;
  };
  total_streams: number;
  total_consumers: number;
}

export interface AccountzResponse {
  server_id: string;
  now: string;
  accounts: string[];
}
