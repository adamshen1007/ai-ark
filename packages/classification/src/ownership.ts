import { isExcludedPath, type ClassificationFile } from "./classifier.js";

export interface SharedAssociation {
  readonly repositoryPath: string;
  readonly rootIds: readonly string[];
}

export interface CandidateOwnership {
  readonly root: string;
  readonly ownedRepositoryPaths: readonly string[];
  readonly sharedRepositoryPaths: readonly string[];
}

export type OwnershipResult =
  | {
      readonly ok: true;
      readonly candidates: readonly CandidateOwnership[];
      readonly excludedRepositoryPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reasonCode:
        "DUPLICATE_PATH_RECORD" | "INVALID_SHARED_ASSOCIATION" | "OWNERSHIP_OVERLAP";
    };

const SHARED_FILES = new Set(["README.md", "LICENSE", "LICENSE.md", "CHANGELOG.md", "SECURITY.md"]);
const sort = (values: Iterable<string>) =>
  [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
const depth = (root: string) => (root === "." ? 0 : root.split("/").length);
const owns = (path: string, root: string) =>
  root === "." || path === root || path.startsWith(`${root}/`);

export function resolveCandidateOwnership(input: {
  readonly files: readonly ClassificationFile[];
  readonly roots: readonly string[];
  readonly sharedAssociations?: readonly SharedAssociation[];
}): OwnershipResult {
  const byPath = new Map<string, ClassificationFile>();
  for (const file of input.files) {
    if (byPath.has(file.normalizedPath)) return { ok: false, reasonCode: "DUPLICATE_PATH_RECORD" };
    byPath.set(file.normalizedPath, file);
  }
  const roots = sort(new Set(input.roots));
  const sharedByPath = new Map<string, readonly string[]>();
  for (const association of input.sharedAssociations ?? []) {
    const associatedRoots = sort(new Set(association.rootIds));
    const associatedFile = byPath.get(association.repositoryPath);
    const isOutsideNested = roots
      .filter((root) => root !== ".")
      .every((root) => !owns(association.repositoryPath, root));
    if (
      !SHARED_FILES.has(association.repositoryPath) ||
      associatedRoots.length < 2 ||
      !isOutsideNested ||
      associatedRoots.some((root) => !roots.includes(root)) ||
      associatedFile?.disposition !== "ACQUIRED" ||
      associatedFile.entryKind !== "file" ||
      associatedFile.contentSha256 === null ||
      sharedByPath.has(association.repositoryPath)
    ) {
      return { ok: false, reasonCode: "INVALID_SHARED_ASSOCIATION" };
    }
    sharedByPath.set(association.repositoryPath, associatedRoots);
  }

  const owned = new Map(roots.map((root) => [root, new Set<string>()]));
  const shared = new Map(roots.map((root) => [root, new Set<string>()]));
  const excluded = new Set<string>();
  for (const file of input.files) {
    if (
      file.disposition !== "ACQUIRED" ||
      file.entryKind !== "file" ||
      file.contentSha256 === null ||
      isExcludedPath(file.normalizedPath)
    ) {
      excluded.add(file.normalizedPath);
      continue;
    }
    const sharedRoots = sharedByPath.get(file.normalizedPath);
    if (sharedRoots) {
      for (const root of sharedRoots) shared.get(root)?.add(file.normalizedPath);
      continue;
    }
    const owner = [...roots]
      .filter((root) => owns(file.normalizedPath, root))
      .sort((left, right) => depth(right) - depth(left))[0];
    if (owner === undefined) excluded.add(file.normalizedPath);
    else owned.get(owner)?.add(file.normalizedPath);
  }

  return {
    ok: true,
    candidates: roots.map((root) => ({
      root,
      ownedRepositoryPaths: sort(owned.get(root) ?? []),
      sharedRepositoryPaths: sort(shared.get(root) ?? []),
    })),
    excludedRepositoryPaths: sort(excluded),
  };
}
