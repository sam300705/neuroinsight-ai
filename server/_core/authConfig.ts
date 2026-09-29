export const MINIMUM_PRODUCTION_SESSION_SECRET_BYTES = 32;

export function sessionApplicationId(rawAppId: string | undefined): string {
  if (!rawAppId || !rawAppId.trim()) {
    throw new Error("VITE_APP_ID must be configured before session authentication is used.");
  }
  return rawAppId;
}

export function sessionSecretBytes(rawSecret: string | undefined, production: boolean): Uint8Array {
  if (!rawSecret || !rawSecret.trim()) {
    throw new Error("JWT_SECRET must be configured before session authentication is used.");
  }

  const secret = new TextEncoder().encode(rawSecret);
  if (production && secret.byteLength < MINIMUM_PRODUCTION_SESSION_SECRET_BYTES) {
    throw new Error(
      `JWT_SECRET must contain at least ${MINIMUM_PRODUCTION_SESSION_SECRET_BYTES} UTF-8 bytes in production.`,
    );
  }
  return secret;
}
