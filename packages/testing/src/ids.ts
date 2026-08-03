import { parseOpaqueId, type OpaqueId } from "@ai-ark/contracts";

export class DeterministicIdGenerator {
  private sequence = 0;

  public next<Kind extends string>(kind: Kind): OpaqueId<Kind> {
    this.sequence += 1;
    return parseOpaqueId(kind, `${kind}_${String(this.sequence).padStart(8, "0")}`);
  }
}
