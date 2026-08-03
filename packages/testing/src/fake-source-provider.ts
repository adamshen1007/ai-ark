import type {
  ForkSignals,
  LicenseSignals,
  ReleaseSignals,
  RepositoryMetadata,
  ResolvedSourceSnapshot,
  SourceEntryContent,
  SourceEntryDescriptor,
  SourceProvider,
  ValidatedSourceReference,
} from "@ai-ark/contracts";

export interface FakeSourceRepository {
  readonly reference: ValidatedSourceReference;
  readonly snapshot: ResolvedSourceSnapshot;
  readonly entries: readonly SourceEntryContent[];
  readonly metadata: RepositoryMetadata;
  readonly releaseSignals: ReleaseSignals;
  readonly licenseSignals: LicenseSignals;
  readonly forkSignals: ForkSignals;
}

export class FakeSourceProvider implements SourceProvider {
  public readonly calls: string[] = [];

  public constructor(private readonly repository: FakeSourceRepository) {}

  public validateReference(input: string): Promise<ValidatedSourceReference> {
    this.calls.push(`validateReference:${input}`);
    if (input !== this.repository.reference.canonicalUrl) {
      return Promise.reject(new Error("SOURCE_NOT_FOUND"));
    }
    return Promise.resolve(this.repository.reference);
  }

  public resolveSnapshot(reference: ValidatedSourceReference): Promise<ResolvedSourceSnapshot> {
    this.calls.push(`resolveSnapshot:${reference.canonicalUrl}`);
    return Promise.resolve(this.repository.snapshot);
  }

  public listEntries(snapshot: ResolvedSourceSnapshot): Promise<readonly SourceEntryDescriptor[]> {
    this.calls.push(`listEntries:${snapshot.immutableRevision}`);
    return Promise.resolve(this.repository.entries.map(({ descriptor }) => descriptor));
  }

  public getRepositoryMetadata(snapshot: ResolvedSourceSnapshot): Promise<RepositoryMetadata> {
    this.calls.push(`getRepositoryMetadata:${snapshot.immutableRevision}`);
    return Promise.resolve(this.repository.metadata);
  }

  public fetchEntry(
    snapshot: ResolvedSourceSnapshot,
    entry: SourceEntryDescriptor,
  ): Promise<SourceEntryContent> {
    this.calls.push(`fetchEntry:${snapshot.immutableRevision}:${entry.path}`);
    const match = this.repository.entries.find(({ descriptor }) => descriptor.path === entry.path);
    if (!match) return Promise.reject(new Error("ENTRY_NOT_FOUND"));
    return Promise.resolve({ descriptor: match.descriptor, bytes: new Uint8Array(match.bytes) });
  }

  public getReleaseSignals(snapshot: ResolvedSourceSnapshot): Promise<ReleaseSignals> {
    this.calls.push(`getReleaseSignals:${snapshot.immutableRevision}`);
    return Promise.resolve(this.repository.releaseSignals);
  }

  public getLicenseSignals(snapshot: ResolvedSourceSnapshot): Promise<LicenseSignals> {
    this.calls.push(`getLicenseSignals:${snapshot.immutableRevision}`);
    return Promise.resolve(this.repository.licenseSignals);
  }

  public getForkSignals(snapshot: ResolvedSourceSnapshot): Promise<ForkSignals> {
    this.calls.push(`getForkSignals:${snapshot.immutableRevision}`);
    return Promise.resolve(this.repository.forkSignals);
  }
}
