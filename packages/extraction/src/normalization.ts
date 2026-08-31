import { canonicalJsonM03 as canonicalJsonContract } from "@ai-ark/contracts";

export {
  canonicalizeSpdx,
  canonicalJsonM03,
  compareUnsignedUtf8,
  handleKey,
  normalizeDependencyName,
  semverKey,
  textKey,
} from "@ai-ark/contracts";

export function canonicalJson(value: unknown): string {
  return canonicalJsonContract(value);
}
