import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { describe, expect, it } from "vitest";

import { startPostgresContainerWithPortRetry } from "./postgres-harness.js";

const portBindingTimeout = new Error(
  "Timed out after 10000ms while waiting for container ports to be bound to the host",
);

describe("disposable PostgreSQL container startup", () => {
  it("returns the first successful container without retrying", async () => {
    const container = {} as StartedPostgreSqlContainer;
    let attempts = 0;
    const result = await startPostgresContainerWithPortRetry(() => {
      attempts += 1;
      return Promise.resolve(container);
    });
    expect(result).toBe(container);
    expect(attempts).toBe(1);
  });

  it("retries the exact transient port-binding timeout once", async () => {
    const container = {} as StartedPostgreSqlContainer;
    let attempts = 0;
    const result = await startPostgresContainerWithPortRetry(() => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(portBindingTimeout);
      return Promise.resolve(container);
    });
    expect(result).toBe(container);
    expect(attempts).toBe(2);
  });

  it("does not retry unrelated startup failures", async () => {
    const failure = new Error("POSTGRES_AUTH_FAILED");
    let attempts = 0;
    await expect(
      startPostgresContainerWithPortRetry(() => {
        attempts += 1;
        return Promise.reject(failure);
      }),
    ).rejects.toBe(failure);
    expect(attempts).toBe(1);
  });

  it("surfaces a repeated port-binding timeout after two attempts", async () => {
    let attempts = 0;
    await expect(
      startPostgresContainerWithPortRetry(() => {
        attempts += 1;
        return Promise.reject(portBindingTimeout);
      }),
    ).rejects.toBe(portBindingTimeout);
    expect(attempts).toBe(2);
  });
});
