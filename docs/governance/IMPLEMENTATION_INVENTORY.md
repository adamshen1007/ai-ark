# M00 starting inventory

## Verified starting state — 2026-08-03

- Authoritative root: `<repository-root>`
- Git state: no `.git` directory; Git commands reported “not a git repository”.
- Implementation: no package manifest, lockfile, runtime pin, CI, source package, database configuration, or tests.
- Repository-specific agent instructions: none.
- Pre-existing content: 23 AI ARK Markdown product, strategy, architecture, design, validation, review, and specification documents; `.DS_Store` files.

## Pre-existing-file preservation

All pre-existing files remain present. During M00 formatting, Prettier rewrote four pre-existing Markdown authority documents before the ignore rules were narrowed. The only operation applied was Markdown formatting, but byte-for-byte originals were unavailable because the starting directory had no Git history, so exact preservation cannot be independently proven. This is recorded as an M00 preservation defect rather than hidden. All other pre-existing documents and `.DS_Store` files were left unchanged.

## M00-authorized changes

- initialize local Git metadata without staging or committing;
- add root workspace, pinned runtime/tooling, packages, tests, fixtures, scripts, CI, and governance documents;
- generate a deterministic lockfile through pnpm.

## Git caveat

Because the starting directory had no Git metadata or base commit, Git cannot distinguish pre-existing documents from M00 files in an ordinary diff. This inventory is the authoritative separation until a later explicitly authorized initial commit.
