import type { NatsConnection } from "@nats-io/transport-node";
import { JetStreamService } from "./jetstream";
import { KvService } from "./kv";
import { NatsService } from "./nats";
import { ObjService } from "./obj";

export interface Services {
  jetstream: JetStreamService;
  kv: KvService;
  nats: NatsService;
  obj: ObjService;
}

export function createServices(nc: NatsConnection): Services {
  return {
    jetstream: new JetStreamService(nc),
    kv: new KvService(nc),
    nats: new NatsService(nc),
    obj: new ObjService(nc),
  };
}
