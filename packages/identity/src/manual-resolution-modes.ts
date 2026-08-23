export interface ManualResolutionMode {
  readonly family: string;
  readonly expansionId: string;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly selectedExpansionId?: string;
}

function product(
  family: string,
  dimensions: Readonly<Record<string, readonly string[]>>,
): ManualResolutionMode[] {
  let rows: Readonly<Record<string, string>>[] = [{}];
  for (const [name, values] of Object.entries(dimensions))
    rows = rows.flatMap((row) => values.map((value) => ({ ...row, [name]: value })));
  return rows.map((row) => ({
    family,
    expansionId: `${family}:${Object.values(row).join(":")}`,
    dimensions: row,
  }));
}

/** Closed Section 15.9 registry. Its cardinality and identifiers are contract evidence. */
export function enumerateManualResolutionModes(): readonly ManualResolutionMode[] {
  const direct = [
    ...product("CREATE_RESOURCE", { P: ["P0", "P1"], K: ["K0", "K1", "K2"], J: ["JC", "JR"] }),
    ...product("ATTACH_NEW_VERSION", {
      A: ["A1", "A2", "A3"],
      P: ["P1", "P2"],
      K: ["K0", "K1", "K2"],
      J: ["JC", "JR"],
    }),
    ...product("MARK_FORK", {
      mode: ["FIRST", "CORRECTION"],
      K: ["K0", "K1", "K2"],
      J: ["JC", "JR"],
    }),
    ...product("MARK_MIRROR", {
      mode: ["FIRST"],
      M: ["M1", "M2"],
      K: ["K0", "K1", "K2"],
      J: ["JC", "JR"],
    }),
    ...product("MARK_MIRROR", { mode: ["CORRECTION"], K: ["K0", "K1", "K2"], J: ["JC", "JR"] }),
    ...product("MARK_DUPLICATE", {
      mode: ["FIRST", "CORRECTION"],
      K: ["K0", "K1", "K2"],
      J: ["JC", "JR", "JE"],
    }),
    ...product("REJECT_CANDIDATE", {
      P: ["P0", "P1"],
      K: ["K0", "K1", "K2"],
      J: ["JC", "JR", "JE"],
    }),
    ...product("SPLIT_ROOTS", { K: ["K0", "K1", "K2"] }),
    ...product("MERGE_ROOTS", { K: ["K0", "K1", "K2"] }),
    ...product("OVERRIDE_NON_SKILL", { K: ["K0", "K1", "K2"] }),
  ];
  const clarification = product("REQUEST_CLARIFICATION", {
    target: ["CLASSIFICATION", "IDENTITY", "REJECTION"],
    T: ["T0", "T1"],
  });
  const ambiguity = direct.map((selected) => ({
    family: "RESOLVE_AMBIGUITY",
    expansionId: `RESOLVE_AMBIGUITY:${selected.expansionId}`,
    dimensions: { selected: selected.expansionId },
    selectedExpansionId: selected.expansionId,
  }));
  const replacement = product("REPLACE_M02_JOB", {
    predecessors: ["SINGLE", "MULTIPLE"],
    Z: ["Z0", "Z1"],
  });
  return [...direct, ...clarification, ...ambiguity, ...replacement];
}
