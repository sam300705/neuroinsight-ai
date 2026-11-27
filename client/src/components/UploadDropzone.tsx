import { FileUp, Image, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AnalysisMode } from "@shared/neuroinsight";
import { useLanguage } from "@/contexts/LanguageContext";

export type LocalFileCheck = { valid: boolean; messages: string[]; warnings: string[]; previewUrl?: string };
export const MAX_CLASSIFICATION_IMAGE_PIXELS = 4_000_000;

export function validateLocalFile(file: File, mode: AnalysisMode): LocalFileCheck {
  const extension = file.name.toLowerCase().split(".").slice(1).join("."); const maxBytes = 50 * 1024 * 1024; const expected = mode === "classification" ? ["png", "jpg", "jpeg"] : ["nii", "nii.gz"]; const acceptableMime = mode === "classification" ? ["image/png", "image/jpeg"] : ["application/x-nifti", "application/nifti", "application/gzip", ""];
  const messages: string[] = []; if (!expected.includes(extension)) messages.push(`Selected mode supports ${expected.map(item => `.${item}`).join(" or ")} files only.`); if (!acceptableMime.includes(file.type)) messages.push("The browser-reported MIME type is incompatible with the selected mode."); if (file.size === 0) messages.push("The selected file is empty."); if (file.size > maxBytes) messages.push("The selected file exceeds the 50 MB upload limit.");
  return { valid: messages.length === 0, messages, warnings: [], previewUrl: mode === "classification" && messages.length === 0 ? URL.createObjectURL(file) : undefined };
}

export function isNiftiHeader(bytes: Uint8Array, compressed: boolean) {
  if (compressed) return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (bytes.length < 4) return false; const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); return view.getInt32(0, true) === 348 || view.getInt32(0, false) === 348;
}

export function imageQualityWarnings(width: number, height: number) {
  const warnings: string[] = []; if (Math.min(width, height) < 128) warnings.push("Input-quality warning: image resolution is below 128 pixels on one axis; manual research review is recommended."); if (Math.max(width, height) / Math.max(Math.min(width, height), 1) > 2.5) warnings.push("Input-quality warning: the image aspect ratio is unusual for the expected 2D research input."); return warnings;
}

export function imagePixelSafetyError(width: number, height: number) {
  return width * height > MAX_CLASSIFICATION_IMAGE_PIXELS ? "The selected image exceeds the 4-megapixel safety limit for this research classifier." : null;
}

export async function validateFileContent(file: File, mode: AnalysisMode): Promise<{ messages: string[]; warnings: string[] }> {
  const header = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (mode === "segmentation") return isNiftiHeader(header, file.name.toLowerCase().endsWith(".gz")) ? { messages: [], warnings: ["Input-quality checks for modality completeness, voxel spacing, orientation, and out-of-distribution appearance require the validated server-side volume pipeline."] } : { messages: ["The selected volume does not have a compatible NIfTI or gzip header. Choose an uncorrupted .nii or .nii.gz file."], warnings: [] };
  const isPng = header.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value); const isJpeg = header.length >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255;
  if (!isPng && !isJpeg) return { messages: ["The selected image does not have a valid PNG or JPEG signature."], warnings: [] };
  if (typeof createImageBitmap === "undefined") return { messages: [], warnings: ["Image decode quality checks are unavailable in this browser; manual research review is recommended."] };
  try { const bitmap = await createImageBitmap(file); const safetyError = imagePixelSafetyError(bitmap.width, bitmap.height); const warnings = imageQualityWarnings(bitmap.width, bitmap.height); bitmap.close(); return { messages: safetyError ? [safetyError] : [], warnings }; } catch { return { messages: ["The selected image could not be decoded and may be corrupted."], warnings: [] }; }
}

export function UploadDropzone({
  mode,
  disabled,
  onCheckingChange,
  onSelect,
}: {
  mode: AnalysisMode;
  disabled: boolean;
  onCheckingChange: (checking: boolean) => void;
  onSelect: (file: File, check: LocalFileCheck) => void;
}) {
  const { language } = useLanguage();
  const hindi = language === "hi";
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const preview = useRef<string | undefined>(undefined);
  const accept =
    mode === "classification"
      ? ".png,.jpg,.jpeg,image/png,image/jpeg"
      : ".nii,.nii.gz,application/x-nifti,application/nifti,application/gzip";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (preview.current) URL.revokeObjectURL(preview.current);
    };
  }, []);

  async function select(file?: File) {
    if (!file || disabled || pending.current) return;
    pending.current = true;
    setChecking(true);
    onCheckingChange(true);

    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = undefined;
    const initial = validateLocalFile(file, mode);
    const content = initial.valid
      ? await validateFileContent(file, mode).catch(() => ({
          messages: [
            hindi
              ? "चुनी हुई फ़ाइल पढ़ी नहीं जा सकी।"
              : "The selected file could not be read.",
          ],
          warnings: [],
        }))
      : { messages: [], warnings: [] };
    const messages = [...initial.messages, ...content.messages];
    const valid = messages.length === 0;
    if (initial.previewUrl && (!mounted.current || !valid))
      URL.revokeObjectURL(initial.previewUrl);
    pending.current = false;
    if (!mounted.current) return;

    preview.current = valid ? initial.previewUrl : undefined;
    onSelect(file, {
      valid,
      messages,
      warnings: [...initial.warnings, ...content.warnings],
      previewUrl: preview.current,
    });
    setChecking(false);
    onCheckingChange(false);
  }

  return (
    <div
      onDragOver={event => {
        event.preventDefault();
        if (!disabled && !checking) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        void select(event.dataTransfer.files[0]);
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8 ${dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-slate-50"}`}
      aria-busy={checking}
    >
      <input
        ref={inputRef}
        id="mri-file-input"
        type="file"
        accept={accept}
        hidden
        disabled={disabled || checking}
        aria-label={hindi ? "MRI फ़ाइल चुनें" : "Choose an MRI file"}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void select(file);
        }}
      />
      <span
        className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-teal-800 shadow-sm"
        aria-hidden="true"
      >
        {mode === "classification" ? (
          <Image className="size-6" />
        ) : (
          <ScanLine className="size-6" />
        )}
      </span>
      <h3 className="mt-3 font-semibold">
        {hindi ? "MRI फ़ाइल यहाँ छोड़ें" : "Drop an MRI file here"}
      </h3>
      <p id="upload-help" className="mt-2 text-sm leading-6 text-slate-600">
        {mode === "classification"
          ? hindi
            ? "एक PNG या JPEG · अधिकतम 50 MB और 4 मेगापिक्सेल"
            : "One PNG or JPEG · Up to 50 MB and 4 megapixels"
          : hindi
            ? "NIfTI (.nii या .nii.gz) · अधिकतम 50 MB"
            : "NIfTI (.nii or .nii.gz) · Up to 50 MB"}
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || checking}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:bg-slate-600"
        aria-controls="mri-file-input"
        aria-describedby="upload-help"
      >
        <FileUp className="size-4" aria-hidden="true" />
        {hindi ? "फ़ाइल चुनें" : "Choose an MRI file"}
      </button>
      {checking && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          {hindi ? "फ़ाइल जाँची जा रही है…" : "Checking the selected file…"}
        </p>
      )}
    </div>
  );
}
