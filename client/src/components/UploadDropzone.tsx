import { FileUp, FileWarning, Image, ScanLine } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { AnalysisMode } from "@shared/neuroinsight";
import { useLanguage } from "@/contexts/LanguageContext";

export type LocalFileCheck = { valid: boolean; messages: string[]; warnings: string[]; previewUrl?: string };
export const MAX_CLASSIFICATION_IMAGE_PIXELS = 12_000_000;

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
  return width * height > MAX_CLASSIFICATION_IMAGE_PIXELS ? "The selected image exceeds the 12-megapixel safety limit for this research classifier." : null;
}

export async function validateFileContent(file: File, mode: AnalysisMode): Promise<{ messages: string[]; warnings: string[] }> {
  const header = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (mode === "segmentation") return isNiftiHeader(header, file.name.toLowerCase().endsWith(".gz")) ? { messages: [], warnings: ["Input-quality checks for modality completeness, voxel spacing, orientation, and out-of-distribution appearance require the validated server-side volume pipeline."] } : { messages: ["The selected volume does not have a compatible NIfTI or gzip header. Choose an uncorrupted .nii or .nii.gz file."], warnings: [] };
  const isPng = header.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value); const isJpeg = header.length >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255;
  if (!isPng && !isJpeg) return { messages: ["The selected image does not have a valid PNG or JPEG signature."], warnings: [] };
  if (typeof createImageBitmap === "undefined") return { messages: [], warnings: ["Image decode quality checks are unavailable in this browser; manual research review is recommended."] };
  try { const bitmap = await createImageBitmap(file); const safetyError = imagePixelSafetyError(bitmap.width, bitmap.height); const warnings = imageQualityWarnings(bitmap.width, bitmap.height); bitmap.close(); return { messages: safetyError ? [safetyError] : [], warnings }; } catch { return { messages: ["The selected image could not be decoded and may be corrupted."], warnings: [] }; }
}

export function UploadDropzone({ mode, onSelect }: { mode: AnalysisMode; onSelect: (file: File, check: LocalFileCheck) => void }) {
  const { language } = useLanguage(); const hindi = language === "hi"; const [dragging, setDragging] = useState(false); const inputRef = useRef<HTMLInputElement>(null); const accept = mode === "classification" ? ".png,.jpg,.jpeg,image/png,image/jpeg" : ".nii,.nii.gz,application/x-nifti,application/nifti,application/gzip";
  const select = useCallback(async (file?: File) => { if (!file) return; const initial = validateLocalFile(file, mode); const content = initial.valid ? await validateFileContent(file, mode) : { messages: [], warnings: [] }; const messages = [...initial.messages, ...content.messages]; onSelect(file, { valid: messages.length === 0, messages, warnings: [...initial.warnings, ...content.warnings], previewUrl: messages.length === 0 ? initial.previewUrl : undefined }); }, [mode, onSelect]);
  return <div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void select(event.dataTransfer.files[0]); }} className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-slate-50"}`} aria-describedby="upload-help"><input ref={inputRef} id="mri-file-input" type="file" accept={accept} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none" aria-label={hindi ? "MRI फ़ाइल चुनें" : "Choose an MRI file"} onChange={event => void select(event.target.files?.[0])} /><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-teal-800 shadow-sm" aria-hidden="true">{mode === "classification" ? <Image className="size-6" /> : <ScanLine className="size-6" />}</span><h2 className="mt-4 font-semibold">{hindi ? "समर्थित MRI फ़ाइल यहाँ छोड़ें" : "Drop a supported MRI file here"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{mode === "classification" ? (hindi ? "मोड A PNG या JPEG स्वीकार करता है। कार्यस्थल विश्लेषण स्थिति खुलने से पहले एक्सटेंशन, MIME प्रकार, आकार, हस्ताक्षर और ब्राउज़र डिकोड जाँचता है।" : "Mode A accepts PNG or JPEG. The workspace checks extension, MIME type, size, signature, and browser decode before any analysis status is opened.") : (hindi ? "मोड B संगत NIfTI .nii या .nii.gz वॉल्यूम स्वीकार करता है। कार्यस्थल सर्वर-पक्ष मेटाडेटा सत्यापन से पहले एक्सटेंशन, MIME प्रकार, आकार और NIfTI/gzip हेडर जाँचता है।" : "Mode B accepts a compatible NIfTI .nii or .nii.gz volume. The workspace checks extension, MIME type, size, and NIfTI/gzip header before server-side metadata verification.")}</p><button type="button" onClick={() => inputRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700" aria-controls="mri-file-input"><FileUp className="size-4" aria-hidden="true" />{hindi ? "फ़ाइल चुनें" : "Choose file"}</button><p id="upload-help" className="mt-4 flex justify-center gap-2 text-xs text-slate-500"><FileWarning className="size-4 shrink-0" aria-hidden="true" />{hindi ? "सामग्री जाँच प्रारंभिक है; पूर्ण मोडैलिटी और मेटाडेटा सत्यापन सर्वर-पक्ष पर रहता है।" : "Content checks are preliminary; full modality and metadata validation remains server-side."}</p></div>;
}
