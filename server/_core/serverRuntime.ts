export type PortAvailabilityCheck = (port: number) => Promise<boolean>;

export function configuredPort(rawPort: string | undefined): number {
  const configured = rawPort?.trim() || "3000";
  if (!/^\d+$/.test(configured)) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const port = Number(configured);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

export async function findAvailableDevelopmentPort(
  startPort: number,
  isAvailable: PortAvailabilityCheck,
  attempts = 20,
): Promise<number> {
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error("Port search attempts must be a positive integer.");
  }
  for (let port = startPort; port <= 65_535 && port < startPort + attempts; port++) {
    if (await isAvailable(port)) {
      return port;
    }
  }
  throw new Error("No development port is available in the configured search range.");
}

export async function selectServerPort(
  preferredPort: number,
  production: boolean,
  isAvailable: PortAvailabilityCheck,
): Promise<number> {
  return production ? preferredPort : findAvailableDevelopmentPort(preferredPort, isAvailable);
}

export function startupFailureEvent(error: unknown): string {
  const errorType = error instanceof Error && error.name ? error.name : "UnknownError";
  return `server_start_failed:error_type=${errorType}`;
}
