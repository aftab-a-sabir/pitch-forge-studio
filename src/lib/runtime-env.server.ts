import { AsyncLocalStorage } from "node:async_hooks";

type RuntimeEnv = Record<string, string | undefined>;
type RuntimeEnvDebug = { keys: string[]; processHasSecret: boolean };

const runtimeEnvStorage = new AsyncLocalStorage<RuntimeEnv>();
const runtimeEnvDebugStorage = new AsyncLocalStorage<RuntimeEnvDebug>();

function normalizeRuntimeEnv(env: unknown): RuntimeEnv {
  if (!env || typeof env !== "object") return {};

  return Object.fromEntries(
    Object.entries(env as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function runWithRuntimeEnv<T>(env: unknown, callback: () => T): T {
  const runtimeEnv = normalizeRuntimeEnv(env);
  const debug = {
    keys: Object.keys(env && typeof env === "object" ? (env as Record<string, unknown>) : {}),
    processHasSecret: Boolean(process.env.LOVABLE_API_KEY),
  };
  return runtimeEnvStorage.run(runtimeEnv, () => runtimeEnvDebugStorage.run(debug, callback));
}

export function getRuntimeSecret(name: string): string | undefined {
  return runtimeEnvStorage.getStore()?.[name] || process.env[name];
}

export function requireRuntimeSecret(name: string, serviceName: string): string {
  const value = getRuntimeSecret(name);
  if (value) return value;

  const debug = runtimeEnvDebugStorage.getStore();
  console.error("runtime_secret.missing", {
    name,
    service: serviceName,
    runtime_env_keys: debug?.keys,
    process_has_secret: debug?.processHasSecret,
  });
  throw new Error(`${serviceName} is not configured. Please try again in a moment.`);
}