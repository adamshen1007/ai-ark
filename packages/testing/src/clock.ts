export interface Clock {
  now(): Date;
}

export class FakeClock implements Clock {
  public constructor(private current: Date = new Date("2026-01-01T00:00:00.000Z")) {}

  public now(): Date {
    return new Date(this.current);
  }

  public advance(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new RangeError("Clock advance must be a non-negative safe integer");
    }
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
