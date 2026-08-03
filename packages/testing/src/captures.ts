import type { AuditEventType, JsonValue, Timestamp } from "@ai-ark/contracts";

export interface StructuredLogEntry {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly event: string;
  readonly fields: Readonly<Record<string, JsonValue>>;
}

export class StructuredLogCapture {
  public readonly entries: StructuredLogEntry[] = [];

  public write(entry: StructuredLogEntry): void {
    this.entries.push(structuredClone(entry));
  }
}

export interface CapturedAuditEvent {
  readonly type: AuditEventType;
  readonly subjectId: string;
  readonly occurredAt: Timestamp;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export class AuditCapture {
  public readonly events: CapturedAuditEvent[] = [];

  public append(event: CapturedAuditEvent): void {
    this.events.push(structuredClone(event));
  }
}
