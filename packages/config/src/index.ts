import { z } from "zod";

const optionalUrl = z.url().optional();

export const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DATABASE_URL: optionalUrl,
    OBJECT_STORAGE_ENDPOINT: optionalUrl,
    GITHUB_TOKEN: z.string().min(1).optional(),
    AI_PROVIDER_API_KEY: z.string().min(1).optional(),
  })
  .strict();

export type Environment = z.infer<typeof EnvironmentSchema>;

export function parseEnvironment(input: Readonly<Record<string, string | undefined>>): Environment {
  return EnvironmentSchema.parse({
    NODE_ENV: input.NODE_ENV,
    LOG_LEVEL: input.LOG_LEVEL,
    DATABASE_URL: input.DATABASE_URL,
    OBJECT_STORAGE_ENDPOINT: input.OBJECT_STORAGE_ENDPOINT,
    GITHUB_TOKEN: input.GITHUB_TOKEN,
    AI_PROVIDER_API_KEY: input.AI_PROVIDER_API_KEY,
  });
}

export function redactedEnvironment(environment: Environment): Readonly<Record<string, string>> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) continue;
    redacted[key] = key.endsWith("TOKEN") || key.endsWith("API_KEY") ? "[REDACTED]" : value;
  }
  return redacted;
}
