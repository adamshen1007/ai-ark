export interface ArkError<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export type Result<Value, ErrorType extends ArkError = ArkError> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: ErrorType };

export function ok<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

export function err<ErrorType extends ArkError>(error: ErrorType): Result<never, ErrorType> {
  return { ok: false, error };
}
