# Dependency rules

## Allowed direction

`apps → feature/application packages → contracts/domain → shared primitives`

Infrastructure packages implement inward-owned ports. A lower layer cannot import a higher layer.

## M00–M01 matrix

| Package                  | May depend on internal packages                  |
| ------------------------ | ------------------------------------------------ |
| `@ai-ark/contracts`      | none                                             |
| `@ai-ark/config`         | `@ai-ark/contracts` (reserved; currently unused) |
| `@ai-ark/testing`        | `@ai-ark/contracts`                              |
| `@ai-ark/acquisition`    | `@ai-ark/contracts`                              |
| `@ai-ark/github-source`  | `@ai-ark/contracts`                              |
| `@ai-ark/object-storage` | `@ai-ark/contracts`                              |
| `@ai-ark/job-queue`      | `@ai-ark/contracts`                              |
| `@ai-ark/observability`  | none                                             |

The testing package may additionally consume the M01 application and adapters to compose deterministic integration tests; production dependency direction is unchanged.

The executable policy is `scripts/check-dependency-boundaries.mjs`. Every new package must be added with an explicit allowed dependency set; an unknown package fails closed.

## Always forbidden

- domain → web framework, GitHub SDK, AI SDK, database adapter, or UI;
- UI → database, queue, object storage, provider adapter, or worker;
- source acquisition → editorial or publication implementation;
- AI analysis → approval command;
- provider adapter → editorial UI;
- runtime handling acquired content → child process or dynamic execution.
