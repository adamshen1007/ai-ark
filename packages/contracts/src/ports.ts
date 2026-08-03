export interface ValidatedSourceReference {
  readonly provider: string;
  readonly canonicalUrl: string;
}

export interface ResolvedSourceSnapshot {
  readonly provider: string;
  readonly providerRepositoryId: string;
  readonly immutableRevision: string;
}

export interface SourceEntryDescriptor {
  readonly path: string;
  readonly byteLength: number;
}

export interface SourceEntryContent {
  readonly descriptor: SourceEntryDescriptor;
  readonly bytes: Uint8Array;
}

export interface RepositorySignals {
  readonly archived: boolean;
  readonly fork: boolean;
}

export interface SourceProvider {
  validateReference(input: string): Promise<ValidatedSourceReference>;
  resolveSnapshot(reference: ValidatedSourceReference): Promise<ResolvedSourceSnapshot>;
  listEntries(snapshot: ResolvedSourceSnapshot): Promise<readonly SourceEntryDescriptor[]>;
  fetchEntry(
    snapshot: ResolvedSourceSnapshot,
    entry: SourceEntryDescriptor,
  ): Promise<SourceEntryContent>;
  getRepositorySignals(snapshot: ResolvedSourceSnapshot): Promise<RepositorySignals>;
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
