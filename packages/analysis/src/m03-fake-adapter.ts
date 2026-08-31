import type {
  M03AnalysisExecutionInputV1,
  M03AnalysisExecutionResultV1,
  M03StructuredAnalysisPortV1,
} from "@ai-ark/contracts";

import {
  buildM03OperationInputs,
  createM03TransportFailureAttempt,
  validateM03RawAnalysisResponse,
} from "./m03-analysis.js";

export type DeterministicM03FakeResponse = Uint8Array | { readonly kind: "TIMED_OUT" | "FAILED" };

export class DeterministicM03AnalysisAdapter implements M03StructuredAnalysisPortV1 {
  readonly #responses: readonly DeterministicM03FakeResponse[];
  #callCount = 0;

  public constructor(responses: readonly DeterministicM03FakeResponse[]) {
    this.#responses = responses.map((response) =>
      response instanceof Uint8Array ? Uint8Array.from(response) : response,
    );
  }

  public get callCount(): number {
    return this.#callCount;
  }

  public async analyze(input: M03AnalysisExecutionInputV1): Promise<M03AnalysisExecutionResultV1> {
    await Promise.resolve();
    const operationInputs = buildM03OperationInputs(input);
    const observedInputExcerpts = operationInputs.reduce(
      (count, operation) =>
        count + operation.sourceInputs.filter(({ state }) => state === "SUPPLIED_EXCERPT").length,
      0,
    );
    const observedInputCharacters = operationInputs.reduce(
      (count, operation) =>
        count +
        operation.sourceInputs.reduce(
          (operationCount, sourceInput) =>
            operationCount +
            (sourceInput.state === "SUPPLIED_EXCERPT" ? Array.from(sourceInput.excerpt).length : 0),
          0,
        ),
      0,
    );
    const observed = { observedInputExcerpts, observedInputCharacters };
    const boundedWarnings = operationInputs.some((operation) =>
      operation.sourceInputs.some((sourceInput) => sourceInput.state === "OMITTED_BOUNDED"),
    )
      ? ["AI_INPUT_BOUNDED" as const]
      : [];
    const primaryBytes = this.#responses[0];
    const primaryControl = await input.authorizeInvocation(0, "PRIMARY");
    if (primaryControl !== "PROCEED")
      return {
        attempts: [],
        proposals: [],
        warningCodes: boundedWarnings,
        unrecoveredError: false,
        controlTerminationOrNull: primaryControl,
        ...observed,
      };
    if (primaryBytes === undefined) {
      return {
        attempts: [],
        proposals: [],
        warningCodes: [...boundedWarnings, "AI_OUTPUT_REJECTED"],
        unrecoveredError: true,
        controlTerminationOrNull: null,
        ...observed,
      };
    }
    this.#callCount += 1;
    if (!(primaryBytes instanceof Uint8Array)) {
      const attempt = createM03TransportFailureAttempt(
        {
          ...input,
          operationInputs,
          ordinal: 0,
          purpose: "PRIMARY",
          priorInvalidOutputFingerprintOrNull: null,
        },
        primaryBytes.kind,
      );
      return {
        attempts: [attempt],
        proposals: [],
        warningCodes: [...boundedWarnings, "AI_OUTPUT_REJECTED"],
        unrecoveredError: true,
        controlTerminationOrNull: null,
        ...observed,
      };
    }
    const primary = validateM03RawAnalysisResponse({
      ...input,
      operationInputs,
      ordinal: 0,
      purpose: "PRIMARY",
      priorInvalidOutputFingerprintOrNull: null,
      rawResponseBytes: primaryBytes,
    });
    if (primary.status === "SUCCEEDED") {
      return {
        attempts: [primary.attempt],
        proposals: primary.proposals,
        warningCodes: boundedWarnings,
        unrecoveredError: false,
        controlTerminationOrNull: null,
        ...observed,
      };
    }
    const repairBytes = this.#responses[1];
    if (!primary.repairable || repairBytes === undefined) {
      return {
        attempts: [primary.attempt],
        proposals: [],
        warningCodes: [...boundedWarnings, "AI_OUTPUT_REJECTED"],
        unrecoveredError: true,
        controlTerminationOrNull: null,
        ...observed,
      };
    }
    const repairControl = await input.authorizeInvocation(1, "SYNTACTIC_REPAIR");
    if (repairControl !== "PROCEED")
      return {
        attempts: [primary.attempt],
        proposals: [],
        warningCodes: boundedWarnings,
        unrecoveredError: false,
        controlTerminationOrNull: repairControl,
        ...observed,
      };
    this.#callCount += 1;
    if (!(repairBytes instanceof Uint8Array)) {
      const repairAttempt = createM03TransportFailureAttempt(
        {
          ...input,
          operationInputs,
          ordinal: 1,
          purpose: "SYNTACTIC_REPAIR",
          priorInvalidOutputFingerprintOrNull: primary.attempt.outputFingerprintOrNull,
        },
        repairBytes.kind,
      );
      return {
        attempts: [primary.attempt, repairAttempt],
        proposals: [],
        warningCodes: [...boundedWarnings, "AI_OUTPUT_REJECTED"],
        unrecoveredError: true,
        controlTerminationOrNull: null,
        ...observed,
      };
    }
    const repair = validateM03RawAnalysisResponse({
      ...input,
      operationInputs,
      ordinal: 1,
      purpose: "SYNTACTIC_REPAIR",
      priorInvalidOutputFingerprintOrNull: primary.attempt.outputFingerprintOrNull,
      rawResponseBytes: repairBytes,
    });
    if (repair.status === "SUCCEEDED") {
      return {
        attempts: [primary.attempt, repair.attempt],
        proposals: repair.proposals,
        warningCodes: [...boundedWarnings, "AI_OUTPUT_REPAIRED"],
        unrecoveredError: false,
        controlTerminationOrNull: null,
        ...observed,
      };
    }
    return {
      attempts: [primary.attempt, repair.attempt],
      proposals: [],
      warningCodes: [...boundedWarnings, "AI_OUTPUT_REJECTED"],
      unrecoveredError: true,
      controlTerminationOrNull: null,
      ...observed,
    };
  }
}
