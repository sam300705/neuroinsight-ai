import { describe, expect, it, vi } from "vitest";
import { imagePixelSafetyError, imageQualityWarnings, isNiftiHeader, validateLocalFile } from "./UploadDropzone";

function fileLike(name: string, type: string, size: number) { return { name, type, size } as File; }

describe("validateLocalFile", () => {
  it("rejects a NIfTI file in the 2D classification mode", () => {
    const result = validateLocalFile(fileLike("volume.nii.gz", "application/gzip", 1024), "classification");
    expect(result.valid).toBe(false); expect(result.messages.join(" ")).toContain(".png");
  });
  it("rejects empty, oversized, and MIME-incompatible image uploads", () => {
    const empty = validateLocalFile(fileLike("scan.png", "image/png", 0), "classification");
    const huge = validateLocalFile(fileLike("scan.png", "image/png", 51 * 1024 * 1024), "classification");
    const wrongMime = validateLocalFile(fileLike("scan.png", "application/pdf", 1024), "classification");
    expect(empty.messages).toContain("The selected file is empty."); expect(huge.messages.join(" ")).toContain("50 MB"); expect(wrongMime.messages.join(" ")).toContain("MIME");
  });
  it("accepts a compatible image and produces a local preview reference", () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:preview") });
    const result = validateLocalFile(fileLike("scan.jpeg", "image/jpeg", 1024), "classification");
    expect(result).toEqual({ valid: true, messages: [], warnings: [], previewUrl: "blob:preview" });
    vi.unstubAllGlobals();
  });
  it("rejects invalid NIfTI headers while recognizing gzip and uncompressed NIfTI signatures", () => {
    const nifti = new Uint8Array(352); new DataView(nifti.buffer).setInt32(0, 348, true);
    expect(isNiftiHeader(nifti, false)).toBe(true); expect(isNiftiHeader(new Uint8Array([31, 139]), true)).toBe(true); expect(isNiftiHeader(new Uint8Array([1, 2, 3, 4]), false)).toBe(false);
  });
  it("emits non-diagnostic manual-review warnings for low-resolution or unusual-aspect-ratio images", () => {
    expect(imageQualityWarnings(96, 80).join(" ")).toContain("manual research review"); expect(imageQualityWarnings(1024, 200).join(" ")).toContain("aspect ratio");
  });
  it("rejects images that exceed the server-aligned 4-megapixel safety limit", () => {
    expect(imagePixelSafetyError(3000, 2000)).toContain("4-megapixel safety limit"); expect(imagePixelSafetyError(2000, 2000)).toBeNull();
  });
});
