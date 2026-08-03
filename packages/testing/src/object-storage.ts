export interface StoredObject {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export class ObjectStorageTestAdapter {
  private readonly objects = new Map<string, StoredObject>();

  public put(object: StoredObject): Promise<void> {
    if (this.objects.has(object.key)) return Promise.reject(new Error("OBJECT_ALREADY_EXISTS"));
    this.objects.set(object.key, { ...object, bytes: new Uint8Array(object.bytes) });
    return Promise.resolve();
  }

  public get(key: string): Promise<StoredObject | undefined> {
    const object = this.objects.get(key);
    return Promise.resolve(object ? { ...object, bytes: new Uint8Array(object.bytes) } : undefined);
  }

  public keys(): readonly string[] {
    return [...this.objects.keys()].sort();
  }
}
