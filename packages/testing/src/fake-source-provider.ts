import type {
  RepositorySignals,
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
  readonly signals: RepositorySignals;
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

  public fetchEntry(
    snapshot: ResolvedSourceSnapshot,
    entry: SourceEntryDescriptor,
  ): Promise<SourceEntryContent> {
    this.calls.push(`fetchEntry:${snapshot.immutableRevision}:${entry.path}`);
    const match = this.repository.entries.find(({ descriptor }) => descriptor.path === entry.path);
    if (!match) return Promise.reject(new Error("ENTRY_NOT_FOUND"));
    return Promise.resolve({ descriptor: match.descriptor, bytes: new Uint8Array(match.bytes) });
  }

  public getRepositorySignals(snapshot: ResolvedSourceSnapshot): Promise<RepositorySignals> {
    this.calls.push(`getRepositorySignals:${snapshot.immutableRevision}`);
    return Promise.resolve(this.repository.signals);
  }
}
