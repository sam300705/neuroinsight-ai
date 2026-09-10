import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalPassportAttestationPayload,
  sha256Hex,
  signPassportAttestation,
  verifyPassportAttestation,
  type PassportAttestationPayload,
} from "./passportAttestation";

const payload: PassportAttestationPayload = {
  passportSha256: "a".repeat(64),
  analysisReceiptSha256: "b".repeat(64),
  releaseManifestSha256: "c".repeat(64),
  modelVersion: "bdneuro-v7-resnet50-head-only-exp005",
  scope: "academic_non_clinical_research",
};

describe("passport attestation", () => {
  it("signs and verifies a canonical Ed25519 payload", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const attestation = signPassportAttestation(
      payload,
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      "research-passport-key-1",
    );
    expect(attestation.payloadSha256).toBe(sha256Hex(canonicalPassportAttestationPayload(payload)));
    expect(verifyPassportAttestation(
      attestation,
      publicKey.export({ type: "spki", format: "pem" }).toString(),
    )).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const attestation = signPassportAttestation(
      payload,
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      "research-passport-key-1",
    );
    const tampered = {
      ...attestation,
      payload: { ...attestation.payload, modelVersion: "fabricated-model" },
    };
    expect(verifyPassportAttestation(
      tampered,
      publicKey.export({ type: "spki", format: "pem" }).toString(),
    )).toBe(false);
  });

  it("rejects malformed digests and non-Ed25519 keys", () => {
    expect(() => canonicalPassportAttestationPayload({ ...payload, passportSha256: "nope" })).toThrow(/SHA-256/);
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() => signPassportAttestation(
      payload,
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      "wrong-key",
    )).toThrow(/Ed25519/);
  });
});
