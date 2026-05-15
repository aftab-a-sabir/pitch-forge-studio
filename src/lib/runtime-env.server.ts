import { AsyncLocalStorage } from "node:async_hooks";

type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnvStorage = new AsyncLocalStorage<RuntimeEnv>();

function normalizeRuntimeEnv(env: unknown): RuntimeEnv {
  if (!env || typeof env !== "object") return {};

  return Object.fromEntries(
    Object.entries(env as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function runWithRuntimeEnv<T>(env: unknown, callback: () => T): T {
  return runtimeEnvStorage.run(normalizeRuntimeEnv(env), callback);
}

export function getRuntimeSecret(name: string): string | undefined {
  return runtimeEnvStorage.getStore()?.[name] || process.env[name];
}

export function requireRuntimeSecret(name: string, serviceName: string): string {
  const value = getRuntimeSecret(name);
  if (value) return value;

  console.error("runtime_secret.missing", { name, service: serviceName });
  throw new Error(`${serviceName} is not configured. Please try again in a moment.`);
}