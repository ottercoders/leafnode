import type {
  KvEntryView,
  MessageQueryOpts,
  NatsMessageView,
  StreamInfoView,
  KvBucketInfoView,
  ObjStoreInfoView,
  ObjectInfoView,
} from "./nats";
import type {
  SavedSubscription,
  SavedTemplate,
  MessageBookmark,
} from "../services/bookmarks";
import type { VarzResponse, ConnzResponse, JszResponse, AccountzResponse } from "./monitoring";

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
  | { type: "kv:history"; connectionId: string; bucket: string; key: string }
  | {
      type: "kv:watch";
      connectionId: string;
      bucket: string;
      key?: string;
      id: string;
    }
  | { type: "kv:unwatch"; id: string }
  | { type: "export:messages"; data: string }
  | { type: "obj:stores"; connectionId: string }
  | { type: "obj:objects"; connectionId: string; store: string }
  | { type: "obj:info"; connectionId: string; store: string; name: string }
  | { type: "obj:delete"; connectionId: string; store: string; name: string }
  | { type: "message:republish"; connectionId: string; subject: string; payload: string; headers?: Record<string, string> }
  | { type: "bookmarks:list" }
  | { type: "bookmarks:saveSubscription"; name: string; subject: string }
  | { type: "bookmarks:deleteSubscription"; name: string }
  | { type: "bookmarks:saveTemplate"; template: SavedTemplate }
  | { type: "bookmarks:deleteTemplate"; name: string }
  | { type: "bookmarks:saveMessage"; bookmark: MessageBookmark }
  | { type: "bookmarks:deleteMessage"; name: string }
  | { type: "stream:search"; connectionId: string; stream: string; pattern: string; limit?: number }
  | { type: "monitor:varz"; connectionId: string }
  | { type: "monitor:connz"; connectionId: string }
  | { type: "monitor:jsz"; connectionId: string }
  | { type: "monitor:accountz"; connectionId: string };

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
  | { type: "kv:watch:update"; id: string; entry: KvEntryView }
  | { type: "obj:stores:data"; stores: ObjStoreInfoView[] }
  | { type: "obj:objects:data"; objects: ObjectInfoView[] }
  | { type: "obj:info:data"; info: ObjectInfoView }
  | {
      type: "bookmarks:data";
      subscriptions: SavedSubscription[];
      templates: SavedTemplate[];
      bookmarks: MessageBookmark[];
    }
  | { type: "stream:search:data"; messages: NatsMessageView[] }
  | { type: "message:republished" }
  | { type: "error"; message: string }
  | { type: "monitor:varz:data"; data: VarzResponse }
  | { type: "monitor:connz:data"; data: ConnzResponse }
  | { type: "monitor:jsz:data"; data: JszResponse }
  | { type: "monitor:accountz:data"; data: AccountzResponse };
