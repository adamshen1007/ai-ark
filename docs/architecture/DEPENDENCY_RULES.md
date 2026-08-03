# Dependency rules

## Allowed direction

`apps → feature/application packages → contracts/domain → shared primitives`

Infrastructure packages implement inward-owned ports. A lower layer cannot import a higher layer.

## M00 matrix

| Package             | May depend on internal packages                  |
| ------------------- | ------------------------------------------------ |
| `@ai-ark/contracts` | none                                             |
| `@ai-ark/config`    | `@ai-ark/contracts` (reserved; currently unused) |
| `@ai-ark/testing`   | `@ai-ark/contracts`                              |

The executable policy is `scripts/check-dependency-boundaries.mjs`. Every new package must be added with an explicit allowed dependency set; an unknown package fails closed.

## Always forbidden

- domain → web framework, GitHub SDK, AI SDK, database adapter, or UI;
- UI → database, queue, object storage, provider adapter, or worker;
- source acquisition → editorial or publication implementation;
- AI analysis → approval command;
- provider adapter → editorial UI;
- runtime handling acquired content → child process or dynamic execution.
