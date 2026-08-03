import { createHash } from "node:crypto";
import type { ObjectStorage, StoredSourceObject } from "@ai-ark/contracts";

function clone(object: StoredSourceObject): StoredSourceObject {
  return { ...object, bytes: new Uint8Array(object.bytes) };
}

function validate(object: StoredSourceObject): void {
  const actual = createHash("sha256").update(object.bytes).digest("hex");
  if (actual !== object.sha256) throw new Error("OBJECT_HASH_MISMATCH");
  if (object.key !== `source-files/sha256/${object.sha256.slice(0, 2)}/${object.sha256}`) {
    throw new Error("OBJECT_KEY_HASH_MISMATCH");
  }
}

export class DeterministicObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredSourceObject>();

  public putIfAbsent(object: StoredSourceObject): Promise<"stored" | "exists"> {
    return Promise.resolve().then(() => {
      validate(object);
      const existing = this.objects.get(object.key);
      if (existing !== undefined) {
        if (existing.sha256 !== object.sha256) throw new Error("IMMUTABLE_OBJECT_CONFLICT");
        return "exists";
      }
      this.objects.set(object.key, clone(object));
      return "stored";
    });
  }

  public get(key: string): Promise<StoredSourceObject | undefined> {
    const object = this.objects.get(key);
    return Promise.resolve(object === undefined ? undefined : clone(object));
  }

  public keys(): readonly string[] {
    return [...this.objects.keys()].sort();
  }
}

export interface S3CompatibleClient {
  putIfAbsent(
    key: string,
    bytes: Uint8Array,
    metadata: Readonly<Record<string, string>>,
  ): Promise<"stored" | "exists">;
  get(
    key: string,
  ): Promise<
    { readonly bytes: Uint8Array; readonly metadata: Readonly<Record<string, string>> } | undefined
  >;
}

export class S3CompatibleObjectStorage implements ObjectStorage {
  public constructor(private readonly client: S3CompatibleClient) {}

  public putIfAbsent(object: StoredSourceObject): Promise<"stored" | "exists"> {
    return Promise.resolve().then(() => {
      validate(object);
      return this.client.putIfAbsent(object.key, new Uint8Array(object.bytes), {
        "content-type": object.contentType,
        sha256: object.sha256,
      });
    });
  }

  public async get(key: string): Promise<StoredSourceObject | undefined> {
    const object = await this.client.get(key);
    if (object === undefined) return undefined;
    const sha256 = object.metadata.sha256;
    const contentType = object.metadata["content-type"];
    if (sha256 === undefined || contentType === undefined)
      throw new Error("OBJECT_METADATA_INVALID");
    const stored = { key, bytes: new Uint8Array(object.bytes), contentType, sha256 };
    validate(stored);
    return stored;
  }
}
