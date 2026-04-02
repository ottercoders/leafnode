import type {
  KvEntryView,
  MessageQueryOpts,
  NatsMessageView,
  StreamInfoView,
  KvBucketInfoView,
} from "./nats";

// Messages from webview to extension host
export type ExtensionMessage =
  | { type: "streams:list"; connectionId: string }
  | {
      type: "stream:messages";
      connectionId: string;
      stream: string;
      opts: MessageQueryOpts;
    }
  | {
      type: "publish";
      connectionId: string;
      subject: string;
      payload: string;
      headers?: Record<string, string>;
    }
  | { type: "subscribe"; connectionId: string; subject: string; id: string }
  | { type: "unsubscribe"; id: string }
  | {
      type: "request";
      connectionId: string;
      subject: string;
      payload: string;
      headers?: Record<string, string>;
      timeout?: number;
    }
  | { type: "kv:buckets"; connectionId: string }
  | { type: "kv:keys"; connectionId: string; bucket: string }
  | { type: "kv:get"; connectionId: string; bucket: string; key: string }
  | {
      type: "kv:put";
      connectionId: string;
      bucket: string;
      key: string;
      value: string;
    }
  | { type: "kv:delete"; connectionId: string; bucket: string; key: string }
  | { type: "kv:history"; connectionId: string; bucket: string; key: string };

// Messages from extension host to webview
export type WebviewMessage =
  | { type: "streams:data"; streams: StreamInfoView[] }
  | { type: "stream:messages:data"; messages: NatsMessageView[] }
  | { type: "subscription:message"; id: string; message: NatsMessageView }
  | { type: "request:response"; message: NatsMessageView; durationMs: number }
  | { type: "request:error"; error: string }
  | { type: "kv:buckets:data"; buckets: KvBucketInfoView[] }
  | { type: "kv:keys:data"; keys: string[] }
  | { type: "kv:entry"; entry: KvEntryView }
  | { type: "kv:history:data"; entries: KvEntryView[] }
  | { type: "error"; message: string };
