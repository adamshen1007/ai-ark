export interface ValidatedSourceReference {
  readonly provider: "github";
  readonly canonicalUrl: string;
  readonly owner: string;
  readonly repository: string;
}

export interface ResolvedSourceSnapshot {
  readonly provider: string;
  readonly providerRepositoryId: string;
  readonly immutableRevision: string;
  readonly canonicalUrl: string;
  readonly defaultBranch: string;
}

export interface SourceEntryDescriptor {
  readonly path: string;
  readonly byteLength: number;
  readonly kind: "file" | "symlink" | "submodule";
  readonly objectId: string;
  readonly executable?: boolean;
}

export interface SourceEntryContent {
  readonly descriptor: SourceEntryDescriptor;
  readonly bytes: Uint8Array;
}

export interface RepositoryMetadata {
  readonly name: string;
  readonly owner: string;
  readonly description: string | null;
  readonly archived: boolean;
  readonly visibility: "public" | "private";
}

export interface ReleaseSignals {
  readonly tags: readonly string[];
  readonly latestRelease: string | null;
}

export interface LicenseSignals {
  readonly spdxId: string | null;
  readonly source: "api" | "file" | "missing";
}

export interface ForkSignals {
  readonly isFork: boolean;
  readonly parentCanonicalUrl: string | null;
}

export interface SourceProvider {
  validateReference(input: string): Promise<ValidatedSourceReference>;
  resolveSnapshot(reference: ValidatedSourceReference): Promise<ResolvedSourceSnapshot>;
  getRepositoryMetadata(snapshot: ResolvedSourceSnapshot): Promise<RepositoryMetadata>;
  listEntries(snapshot: ResolvedSourceSnapshot): Promise<readonly SourceEntryDescriptor[]>;
  fetchEntry(
    snapshot: ResolvedSourceSnapshot,
    entry: SourceEntryDescriptor,
  ): Promise<SourceEntryContent>;
  getReleaseSignals(snapshot: ResolvedSourceSnapshot): Promise<ReleaseSignals>;
  getLicenseSignals(snapshot: ResolvedSourceSnapshot): Promise<LicenseSignals>;
  getForkSignals(snapshot: ResolvedSourceSnapshot): Promise<ForkSignals>;
}

export interface StoredSourceObject {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly sha256: string;
}

export interface ObjectStorage {
  putIfAbsent(object: StoredSourceObject): Promise<"stored" | "exists">;
  get(key: string): Promise<StoredSourceObject | undefined>;
}

export interface OutputContract<Output> {
  parse(value: unknown): Output;
}

export interface AnalysisRequest<Output> {
  readonly operation: string;
  readonly input: unknown;
  readonly outputContract: OutputContract<Output>;
  readonly promptBundleVersion: string;
}

export interface AnalysisProvider {
  analyze<Output>(request: AnalysisRequest<Output>): Promise<Output>;
}
