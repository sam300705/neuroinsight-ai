import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const SHA256_HEX = /^[a-f0-9]{64}$/;

export type PassportAttestationPayload = {
  passportSha256: string;
  analysisReceiptSha256: string;
  releaseManifestSha256: string;
  modelVersion: string;
  scope: "academic_non_clinical_research";
};

export type PassportAttestation = {
  schemaVersion: "neuroinsight-passport-attestation/v1";
  algorithm: "Ed25519";
  keyId: string;
  payload: PassportAttestationPayload;
  payloadSha256: string;
  signatureBase64: string;
};

function validatePayload(payload: PassportAttestationPayload) {
  for (const [name, value] of [
    ["passportSha256", payload.passportSha256],
    ["analysisReceiptSha256", payload.analysisReceiptSha256],
    ["releaseManifestSha256", payload.releaseManifestSha256],
  ] as const) {
    if (!SHA256_HEX.test(value)) throw new Error(`${name} must be a lowercase SHA-256 hex digest.`);
  }
  if (!payload.modelVersion.trim() || payload.modelVersion.length > 256) {
    throw new Error("modelVersion must be a bounded non-empty identifier.");
  }
  if (payload.scope !== "academic_non_clinical_research") {
    throw new Error("Passport attestation scope must remain academic_non_clinical_research.");
  }
}

export function canonicalPassportAttestationPayload(payload: PassportAttestationPayload): string {
  validatePayload(payload);
  return JSON.stringify({
    analysisReceiptSha256: payload.analysisReceiptSha256,
    modelVersion: payload.modelVersion,
    passportSha256: payload.passportSha256,
    releaseManifestSha256: payload.releaseManifestSha256,
    scope: payload.scope,
  });
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function signPassportAttestation(
  payload: PassportAttestationPayload,
  privateKeyPem: string,
  keyId: string,
): PassportAttestation {
  if (!keyId.trim() || keyId.length > 128) throw new Error("keyId must be a bounded non-empty identifier.");
  const canonical = canonicalPassportAttestationPayload(payload);
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Passport attestations require an Ed25519 private key.");
  const signature = sign(null, Buffer.from(canonical, "utf8"), privateKey);
  return {
    schemaVersion: "neuroinsight-passport-attestation/v1",
    algorithm: "Ed25519",
    keyId,
    payload,
    payloadSha256: sha256Hex(canonical),
    signatureBase64: signature.toString("base64"),
  };
}

export function verifyPassportAttestation(
  attestation: PassportAttestation,
  trustedPublicKeyPem: string,
): boolean {
  if (
    attestation.schemaVersion !== "neuroinsight-passport-attestation/v1" ||
    attestation.algorithm !== "Ed25519" ||
    !attestation.keyId.trim() ||
    attestation.keyId.length > 128
  ) return false;

  let canonical: string;
  try {
    canonical = canonicalPassportAttestationPayload(attestation.payload);
  } catch {
    return false;
  }
  if (sha256Hex(canonical) !== attestation.payloadSha256) return false;

  try {
    const publicKey = createPublicKey(trustedPublicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") return false;
    return verify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      Buffer.from(attestation.signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}
