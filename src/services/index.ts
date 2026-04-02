import type { NatsConnection } from "@nats-io/transport-node";
import { JetStreamService } from "./jetstream";
import { KvService } from "./kv";
import { NatsService } from "./nats";

export interface Services {
  jetstream: JetStreamService;
  kv: KvService;
  nats: NatsService;
}

export function createServices(nc: NatsConnection): Services {
  return {
    jetstream: new JetStreamService(nc),
    kv: new KvService(nc),
    nats: new NatsService(nc),
  };
}
