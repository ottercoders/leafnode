import type { NatsConnection } from "@nats-io/transport-node";
import { Objm } from "@nats-io/obj";
import type { ObjStoreInfoView, ObjectInfoView } from "../types/nats";

export class ObjService {
  private objm: Objm;

  constructor(nc: NatsConnection) {
    this.objm = new Objm(nc);
  }

  async listStores(): Promise<ObjStoreInfoView[]> {
    const stores: ObjStoreInfoView[] = [];
    for await (const status of this.objm.list()) {
      const os = await this.objm.open(status.bucket);
      const objects = await os.list();
      const activeObjects = objects.filter((o) => !o.deleted);
      stores.push({
        name: status.bucket,
        size: status.size,
        objects: activeObjects.length,
        sealed: status.sealed,
      });
    }
    return stores;
  }

  async listObjects(storeName: string): Promise<ObjectInfoView[]> {
    const os = await this.objm.open(storeName);
    const objects = await os.list();
    return objects
      .filter((o) => !o.deleted)
      .map((o) => toObjectInfoView(o));
  }

  async getObjectInfo(
    storeName: string,
    objectName: string,
  ): Promise<ObjectInfoView | null> {
    const os = await this.objm.open(storeName);
    const info = await os.info(objectName);
    if (!info) return null;
    return toObjectInfoView(info);
  }

  async deleteObject(storeName: string, objectName: string): Promise<void> {
    const os = await this.objm.open(storeName);
    await os.delete(objectName);
  }
}

function toObjectInfoView(o: {
  name: string;
  size: number;
  chunks: number;
  mtime: string;
  digest: string;
}): ObjectInfoView {
  return {
    name: o.name,
    size: o.size,
    chunks: o.chunks,
    lastModified: o.mtime,
    digest: o.digest,
  };
}
