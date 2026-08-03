import { z } from "zod";

export const CONTRACT_SCHEMA_VERSION = "0.1.0" as const;
export const SchemaVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

export interface VersionedContract {
  readonly schemaVersion: SchemaVersion;
}
