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

export interface GitHubRepositoryResponse {
  readonly id: number;
  readonly name: string;
  readonly owner: { readonly login: string };
  readonly description: string | null;
  readonly default_branch: string;
  readonly archived: boolean;
  readonly private: boolean;
  readonly fork: boolean;
  readonly parent?: { readonly html_url: string };
}

export interface GitHubCommitResponse {
  readonly sha: string;
}

export interface GitHubTreeEntryResponse {
  readonly path: string;
  readonly type: "blob" | "commit" | "tree";
  readonly mode: string;
  readonly sha: string;
  readonly size?: number;
}

export interface GitHubTreeResponse {
  readonly truncated: boolean;
  readonly tree: readonly GitHubTreeEntryResponse[];
}

export interface GitHubTransport {
  getRepository(owner: string, repository: string): Promise<GitHubRepositoryResponse>;
  getCommit(owner: string, repository: string, reference: string): Promise<GitHubCommitResponse>;
  getTree(owner: string, repository: string, revision: string): Promise<GitHubTreeResponse>;
  getBlob(owner: string, repository: string, objectId: string): Promise<Uint8Array>;
  getTags(owner: string, repository: string): Promise<readonly string[]>;
  getLatestRelease(owner: string, repository: string): Promise<string | null>;
  getLicense(owner: string, repository: string): Promise<{ readonly spdxId: string | null } | null>;
}

const ownerPattern = /^(?!.*--)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const repositoryPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/u;

export type GitHubReferenceErrorCode = "INVALID_SOURCE_REFERENCE" | "UNSUPPORTED_SOURCE_REFERENCE";

export class GitHubReferenceError extends Error {
  public constructor(public readonly code: GitHubReferenceErrorCode) {
    super(code);
    this.name = "GitHubReferenceError";
  }
}

export function normalizeGitHubReference(input: string): ValidatedSourceReference {
  if (input.trim() !== input || input.length > 500) {
    throw new GitHubReferenceError("INVALID_SOURCE_REFERENCE");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new GitHubReferenceError("INVALID_SOURCE_REFERENCE");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new GitHubReferenceError("UNSUPPORTED_SOURCE_REFERENCE");
  }
  if (!/^\/[^/]+\/[^/]+\/?$/u.test(url.pathname)) {
    throw new GitHubReferenceError("UNSUPPORTED_SOURCE_REFERENCE");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) throw new GitHubReferenceError("UNSUPPORTED_SOURCE_REFERENCE");
  const owner = parts[0];
  const rawRepository = parts[1];
  if (owner === undefined || rawRepository === undefined) {
    throw new GitHubReferenceError("INVALID_SOURCE_REFERENCE");
  }
  const repository = rawRepository.endsWith(".git") ? rawRepository.slice(0, -4) : rawRepository;
  if (!ownerPattern.test(owner) || !repositoryPattern.test(repository)) {
    throw new GitHubReferenceError("INVALID_SOURCE_REFERENCE");
  }
  return {
    provider: "github",
    owner,
    repository,
    canonicalUrl: `https://github.com/${owner}/${repository}`,
  };
}

function assertRepositoryIdentity(
  repository: GitHubRepositoryResponse,
  reference: ValidatedSourceReference,
  expectedRepositoryId?: string,
): void {
  if (repository.private) throw new Error("SOURCE_PRIVATE");
  if (!Number.isSafeInteger(repository.id) || repository.id <= 0) {
    throw new Error("INVALID_REPOSITORY_ID");
  }
  if (
    repository.owner.login.toLowerCase() !== reference.owner.toLowerCase() ||
    repository.name.toLowerCase() !== reference.repository.toLowerCase() ||
    (expectedRepositoryId !== undefined && String(repository.id) !== expectedRepositoryId)
  ) {
    throw new Error("AMBIGUOUS_REDIRECT");
  }
}

export class GitHubSourceProvider implements SourceProvider {
  public constructor(private readonly transport: GitHubTransport) {}

  private async verifiedRepository(snapshot: ResolvedSourceSnapshot): Promise<{
    readonly reference: ValidatedSourceReference;
    readonly repository: GitHubRepositoryResponse;
  }> {
    const reference = normalizeGitHubReference(snapshot.canonicalUrl);
    const repository = await this.transport.getRepository(reference.owner, reference.repository);
    assertRepositoryIdentity(repository, reference, snapshot.providerRepositoryId);
    return { reference, repository };
  }

  public validateReference(input: string): Promise<ValidatedSourceReference> {
    return Promise.resolve().then(() => normalizeGitHubReference(input));
  }

  public async resolveSnapshot(
    reference: ValidatedSourceReference,
  ): Promise<ResolvedSourceSnapshot> {
    const repository = await this.transport.getRepository(reference.owner, reference.repository);
    assertRepositoryIdentity(repository, reference);
    const commit = await this.transport.getCommit(
      reference.owner,
      reference.repository,
      repository.default_branch,
    );
    const repositoryAfterCommit = await this.transport.getRepository(
      reference.owner,
      reference.repository,
    );
    assertRepositoryIdentity(repositoryAfterCommit, reference, String(repository.id));
    if (!/^[a-f0-9]{40}$/u.test(commit.sha)) throw new Error("INVALID_IMMUTABLE_REVISION");
    return {
      provider: "github",
      providerRepositoryId: String(repository.id),
      immutableRevision: commit.sha,
      canonicalUrl: reference.canonicalUrl,
      defaultBranch: repository.default_branch,
    };
  }

  public async getRepositoryMetadata(
    snapshot: ResolvedSourceSnapshot,
  ): Promise<RepositoryMetadata> {
    const { repository } = await this.verifiedRepository(snapshot);
    return {
      name: repository.name,
      owner: repository.owner.login,
      description: repository.description,
      archived: repository.archived,
      visibility: "public",
    };
  }

  public async listEntries(
    snapshot: ResolvedSourceSnapshot,
  ): Promise<readonly SourceEntryDescriptor[]> {
    const { reference } = await this.verifiedRepository(snapshot);
    const tree = await this.transport.getTree(
      reference.owner,
      reference.repository,
      snapshot.immutableRevision,
    );
    await this.verifiedRepository(snapshot);
    if (tree.truncated) throw new Error("SOURCE_TREE_TRUNCATED");
    return tree.tree
      .filter((entry) => entry.type !== "tree")
      .map((entry): SourceEntryDescriptor => ({
        path: entry.path,
        byteLength: entry.size ?? 0,
        kind: entry.type === "commit" ? "submodule" : entry.mode === "120000" ? "symlink" : "file",
        objectId: entry.sha,
        executable: entry.mode === "100755",
      }))
      .sort((a, b) => comparePaths(a.path, b.path));
  }

  public async fetchEntry(
    snapshot: ResolvedSourceSnapshot,
    entry: SourceEntryDescriptor,
  ): Promise<SourceEntryContent> {
    if (entry.kind !== "file") throw new Error("UNSUPPORTED_ENTRY_KIND");
    const { reference } = await this.verifiedRepository(snapshot);
    const bytes = await this.transport.getBlob(
      reference.owner,
      reference.repository,
      entry.objectId,
    );
    await this.verifiedRepository(snapshot);
    if (bytes.byteLength !== entry.byteLength) throw new Error("ENTRY_SIZE_MISMATCH");
    return { descriptor: entry, bytes: new Uint8Array(bytes) };
  }

  public async getReleaseSignals(snapshot: ResolvedSourceSnapshot): Promise<ReleaseSignals> {
    const { reference } = await this.verifiedRepository(snapshot);
    const [tags, latestRelease] = await Promise.all([
      this.transport.getTags(reference.owner, reference.repository),
      this.transport.getLatestRelease(reference.owner, reference.repository),
    ]);
    await this.verifiedRepository(snapshot);
    return { tags: [...tags].sort(), latestRelease };
  }

  public async getLicenseSignals(snapshot: ResolvedSourceSnapshot): Promise<LicenseSignals> {
    const { reference } = await this.verifiedRepository(snapshot);
    const license = await this.transport.getLicense(reference.owner, reference.repository);
    await this.verifiedRepository(snapshot);
    return { spdxId: license?.spdxId ?? null, source: license === null ? "missing" : "api" };
  }

  public async getForkSignals(snapshot: ResolvedSourceSnapshot): Promise<ForkSignals> {
    const { repository } = await this.verifiedRepository(snapshot);
    return {
      isFork: repository.fork,
      parentCanonicalUrl:
        repository.parent === undefined
          ? null
          : normalizeGitHubReference(repository.parent.html_url).canonicalUrl,
    };
  }
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
