export interface ConnectionConfig {
  id: string;
  name: string;
  servers: string[];
  monitoringUrl?: string;
  auth: AuthConfig;
}

export type AuthConfig =
  | { type: "anonymous" }
  | { type: "token"; tokenSecret: string }
  | { type: "userpass"; user: string; passSecret: string }
  | { type: "nkey"; seedSecret: string }
  | { type: "credentials"; credsSecret: string }
  | {
      type: "tls";
      certPath: string;
      keyPath: string;
      caPath?: string;
    };

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface ConnectionState {
  config: ConnectionConfig;
  status: ConnectionStatus;
  error?: string;
}
