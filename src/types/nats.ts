export interface StreamInfoView {
  name: string;
  config: StreamConfigView;
  state: StreamStateView;
}

export interface StreamConfigView {
  subjects: string[];
  retention: string;
  storage: string;
  replicas: number;
  maxMsgs: number;
  maxBytes: number;
  maxAge: number;
  maxMsgSize: number;
  discard: string;
}

export interface StreamStateView {
  messages: number;
  bytes: number;
  firstSeq: number;
  lastSeq: number;
  firstTs: string;
  lastTs: string;
  consumerCount: number;
}

export interface ConsumerInfoView {
  name: string;
  stream: string;
  config: ConsumerConfigView;
  numPending: number;
  numAckPending: number;
  numRedelivered: number;
}

export interface ConsumerConfigView {
  durableName?: string;
  filterSubject?: string;
  ackPolicy: string;
  deliverPolicy: string;
  maxDeliver: number;
}

export interface NatsMessageView {
  subject: string;
  sequence?: number;
  timestamp: string;
  headers?: Record<string, string[]>;
  payload: string;
  payloadEncoding: "utf8" | "base64";
  size: number;
}

export interface MessageQueryOpts {
  startSeq?: number;
  startTime?: string;
  endSeq?: number;
  subject?: string;
  limit: number;
}

export interface KvBucketInfoView {
  bucket: string;
  values: number;
  bytes: number;
  history: number;
  ttl: number;
  replicas: number;
}

export interface KvEntryView {
  key: string;
  value: string;
  valueEncoding: "utf8" | "base64";
  revision: number;
  created: string;
  operation: string;
}

export interface ObjStoreInfoView {
  name: string;
  size: number;
  objects: number;
  sealed: boolean;
}

export interface ObjectInfoView {
  name: string;
  size: number;
  chunks: number;
  lastModified: string;
  digest: string;
}
