import { createContext, useContext, useEffect, useState } from "react";
import type { AnalysisMode } from "@shared/neuroinsight";

export type ClientAnalysisState = { scanId: string; mode: AnalysisMode; fileName: string; fileSize: number; previewUrl?: string; status: "idle" | "validating" | "ready" | "unavailable" | "incompatible"; messages: string[]; createdAt: string };
type AnalysisContextValue = { current: ClientAnalysisState | null; setCurrent: (analysis: ClientAnalysisState | null) => void };
const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ClientAnalysisState | null>(() => { try { const stored = localStorage.getItem("neuroinsight-current-analysis"); return stored ? JSON.parse(stored) as ClientAnalysisState : null; } catch { return null; } });
  useEffect(() => { if (current) localStorage.setItem("neuroinsight-current-analysis", JSON.stringify(current)); else localStorage.removeItem("neuroinsight-current-analysis"); }, [current]);
  return <AnalysisContext.Provider value={{ current, setCurrent }}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() { const value = useContext(AnalysisContext); if (!value) throw new Error("useAnalysis must be used within AnalysisProvider"); return value; }

