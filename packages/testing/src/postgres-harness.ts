import { randomBytes } from "node:crypto";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const PORT_BINDING_TIMEOUT =
  "Timed out after 10000ms while waiting for container ports to be bound to the host";

export async function startPostgresContainerWithPortRetry(
  start: () => Promise<StartedPostgreSqlContainer>,
): Promise<StartedPostgreSqlContainer> {
  try {
    return await start();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== PORT_BINDING_TIMEOUT) throw error;
    return start();
  }
}

export class EphemeralPostgresHarness {
  private container: StartedPostgreSqlContainer | undefined;
  private pool: Pool | undefined;
  private readonly loginPasswords = new Map<string, string>();
  private readonly runtimePools = new Map<string, Pool>();

  public async start(): Promise<Pool> {
    if (this.container || this.pool) throw new Error("POSTGRES_HARNESS_ALREADY_STARTED");
    this.container = await startPostgresContainerWithPortRetry(() =>
      new PostgreSqlContainer("postgres:17.6-alpine").start(),
    );
    this.pool = new Pool({ connectionString: this.container.getConnectionUri(), max: 4 });
    await this.pool.query("SELECT 1");
    await this.pool.query(
      "CREATE ROLE ai_ark_m04_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION",
    );
    await this.pool.query(
      "CREATE ROLE ai_ark_m01_m02_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION",
    );
    await this.pool.query(
      "CREATE ROLE ai_ark_m04_login LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION",
    );
    await this.pool.query(
      "CREATE ROLE ai_ark_m01_m02_login LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION",
    );
    await this.pool.query(
      "CREATE ROLE ai_ark_hostile_login LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION",
    );
    for (const role of ["ai_ark_m04_login", "ai_ark_m01_m02_login", "ai_ark_hostile_login"]) {
      const password = randomBytes(24).toString("hex");
      this.loginPasswords.set(role, password);
      await this.pool.query(`ALTER ROLE ${role} PASSWORD '${password}'`);
    }
    await this.pool.query("GRANT ai_ark_m04_runtime TO ai_ark_m04_login WITH INHERIT TRUE");
    await this.pool.query("GRANT ai_ark_m01_m02_writer TO ai_ark_m01_m02_login WITH INHERIT TRUE");
    return this.pool;
  }

  public async stop(): Promise<void> {
    for (const runtimePool of this.runtimePools.values()) await runtimePool.end();
    this.runtimePools.clear();
    await this.pool?.end();
    await this.container?.stop();
    this.pool = undefined;
    this.container = undefined;
    this.loginPasswords.clear();
  }

  public connectionUri(): string {
    if (!this.container) throw new Error("POSTGRES_HARNESS_NOT_STARTED");
    return this.container.getConnectionUri();
  }

  public connectionUriForRole(role: string, databaseName?: string): string {
    const password = this.loginPasswords.get(role);
    if (password === undefined) throw new Error("POSTGRES_HARNESS_ROLE_INVALID");
    const uri = new URL(this.connectionUri());
    uri.username = role;
    uri.password = password;
    if (databaseName !== undefined) {
      if (!/^[a-z][a-z0-9_]*$/u.test(databaseName))
        throw new Error("POSTGRES_HARNESS_DATABASE_INVALID");
      uri.pathname = `/${databaseName}`;
    }
    return uri.toString();
  }

  public poolForRole(role: string): Pool {
    let pool = this.runtimePools.get(role);
    if (pool === undefined) {
      pool = new Pool({ connectionString: this.connectionUriForRole(role), max: 4 });
      this.runtimePools.set(role, pool);
    }
    return pool;
  }

  public async execInContainer(
    command: readonly string[],
  ): Promise<{ exitCode: number; output: string }> {
    if (!this.container) throw new Error("POSTGRES_HARNESS_NOT_STARTED");
    const execute = this.container.exec.bind(this.container);
    const result = await execute([...command]);
    return { exitCode: result.exitCode, output: result.output };
  }
}
