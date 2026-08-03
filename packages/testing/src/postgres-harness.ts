import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

export class EphemeralPostgresHarness {
  private container: StartedPostgreSqlContainer | undefined;
  private pool: Pool | undefined;

  public async start(): Promise<Pool> {
    if (this.container || this.pool) throw new Error("POSTGRES_HARNESS_ALREADY_STARTED");
    this.container = await new PostgreSqlContainer("postgres:17.6-alpine").start();
    this.pool = new Pool({ connectionString: this.container.getConnectionUri(), max: 4 });
    await this.pool.query("SELECT 1");
    return this.pool;
  }

  public async stop(): Promise<void> {
    await this.pool?.end();
    await this.container?.stop();
    this.pool = undefined;
    this.container = undefined;
  }
}
