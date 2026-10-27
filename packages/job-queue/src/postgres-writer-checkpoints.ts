import type { PoolClient } from "pg";

// Keep catalog verification on the raw connection so the guard cannot recursively
// intercept its own catalog reads. Every successful transaction statement gets
// a pre/post check; COMMIT gets its final check before PostgreSQL commits.
export function guardedWriterClient(
  client: PoolClient,
  checkpoint: () => Promise<void>,
): PoolClient {
  let inTransaction = false;
  let tail: Promise<void> = Promise.resolve();
  return new Proxy(client, {
    get(target, key, receiver): unknown {
      if (key !== "query") {
        const value: unknown = Reflect.get(target, key, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
      const run = async (args: unknown[]): Promise<unknown> => {
        const first = args[0];
        const sql =
          typeof first === "string"
            ? first
            : typeof first === "object" && first !== null && "text" in first
              ? String(first.text)
              : "";
        const verb = sql.trimStart().split(/\s+/u, 1)[0]?.toUpperCase();
        const begin = verb === "BEGIN";
        const finish = verb === "COMMIT" || verb === "ROLLBACK";
        const needsCheck = inTransaction && verb !== "ROLLBACK";
        if (needsCheck) await checkpoint();
        const query = Reflect.get(target, "query") as (...queryArgs: unknown[]) => Promise<unknown>;
        const result: unknown = await Reflect.apply(query, target, args);
        if (begin) inTransaction = true;
        if (needsCheck && !finish) await checkpoint();
        if (finish) inTransaction = false;
        return result;
      };
      return (...args: unknown[]): Promise<unknown> => {
        const pending = tail.then(() => run(args));
        tail = pending.then(
          () => undefined,
          () => undefined,
        );
        return pending;
      };
    },
  });
}
