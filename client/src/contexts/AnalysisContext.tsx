import { createContext, useContext, useEffect, useState } from "react";
import type { AnalysisMode } from "@shared/neuroinsight";
import type { InferenceAnalysisResponse } from "@/lib/inferenceApi";

/** Analysis state is deliberately memory-only because it contains derived scan data and filenames. */
export type ClientAnalysisState = { scanId: string; mode: AnalysisMode; fileName: string; fileSize: number; previewUrl?: string; status: "idle" | "validating" | "ready" | "low_confidence" | "unavailable" | "incompatible"; messages: string[]; createdAt: string; modelVersion?: string; predictedClass?: "glioma" | "meningioma" | "pituitary" | "no_tumor" | null; modelConfidenceScore?: number | null; calibrated?: boolean; uncertaintyReason?: string | null; gradCamDataUrl?: string | null; serverResponse?: InferenceAnalysisResponse };
type AnalysisContextValue = { current: ClientAnalysisState | null; setCurrent: (analysis: ClientAnalysisState | null) => void };
const AnalysisContext = createContext<AnalysisContextValue | null>(null);
const LEGACY_ANALYSIS_STORAGE_KEY = "neuroinsight-current-analysis";

export function clearLegacyPersistedAnalysis(storage?: Pick<Storage, "removeItem">) {
  try {
    (storage ?? globalThis.localStorage)?.removeItem(LEGACY_ANALYSIS_STORAGE_KEY);
  } catch {
    // Privacy cleanup is best-effort when browser storage is unavailable or blocked.
  }
}

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ClientAnalysisState | null>(null);
  useEffect(() => clearLegacyPersistedAnalysis(), []);
  useEffect(() => () => {
    if (current?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(current.previewUrl);
  }, [current?.previewUrl]);
  return <AnalysisContext.Provider value={{ current, setCurrent }}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() { const value = useContext(AnalysisContext); if (!value) throw new Error("useAnalysis must be used within AnalysisProvider"); return value; }
