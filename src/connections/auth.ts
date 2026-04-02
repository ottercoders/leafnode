import * as vscode from "vscode";
import type { ConnectionOptions } from "@nats-io/transport-node";
import {
  credsAuthenticator,
  nkeyAuthenticator,
} from "@nats-io/transport-node";
import type { ConnectionConfig } from "../types/connection";

export async function buildConnectOptions(
  config: ConnectionConfig,
  secrets: vscode.SecretStorage,
): Promise<ConnectionOptions> {
  const opts: ConnectionOptions = {
    servers: config.servers,
    name: `leafnode:${config.name}`,
  };

  const auth = config.auth;

  switch (auth.type) {
    case "anonymous":
      break;

    case "token": {
      const token = await secrets.get(auth.tokenSecret);
      if (token) opts.token = token;
      break;
    }

    case "userpass": {
      const pass = await secrets.get(auth.passSecret);
      opts.user = auth.user;
      if (pass) opts.pass = pass;
      break;
    }

    case "nkey": {
      const seed = await secrets.get(auth.seedSecret);
      if (seed) {
        opts.authenticator = nkeyAuthenticator(
          new TextEncoder().encode(seed),
        );
      }
      break;
    }

    case "credentials": {
      const creds = await secrets.get(auth.credsSecret);
      if (creds) {
        opts.authenticator = credsAuthenticator(
          new TextEncoder().encode(creds),
        );
      }
      break;
    }

    case "tls": {
      opts.tls = {
        certFile: auth.certPath,
        keyFile: auth.keyPath,
        caFile: auth.caPath,
      };
      break;
    }
  }

  return opts;
}
