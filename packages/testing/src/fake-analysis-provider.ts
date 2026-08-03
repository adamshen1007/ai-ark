import type { AnalysisProvider, AnalysisRequest } from "@ai-ark/contracts";

export class FakeAnalysisProvider implements AnalysisProvider {
  public readonly operations: string[] = [];
  private readonly outputs = new Map<string, unknown>();

  public enqueue(operation: string, output: unknown): void {
    this.outputs.set(operation, output);
  }

  public analyze<Output>(request: AnalysisRequest<Output>): Promise<Output> {
    this.operations.push(request.operation);
    if (!this.outputs.has(request.operation))
      return Promise.reject(new Error("FAKE_OUTPUT_MISSING"));
    return Promise.resolve(request.outputContract.parse(this.outputs.get(request.operation)));
  }
}
