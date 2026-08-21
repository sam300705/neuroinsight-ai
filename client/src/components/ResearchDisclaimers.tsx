import { AlertTriangle, GraduationCap, ScanSearch } from "lucide-react";
import { ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, GRAD_CAM_DISCLAIMER } from "@shared/neuroinsight";

export function AcademicDisclaimer({ compact = false }: { compact?: boolean }) { return <div className={`flex gap-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "px-3 py-2" : "p-4"}`} role="note"><GraduationCap className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className={compact ? "text-xs leading-5" : "text-sm leading-6"}>{ACADEMIC_DISCLAIMER}</p></div>; }
export function GradCamDisclaimer() { return <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950" role="note"><ScanSearch className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-sm leading-6">{GRAD_CAM_DISCLAIMER}</p></div>; }
export function GliomaScopeDisclaimer() { return <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-950" role="note"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-sm leading-6">{GLIOMA_SCOPE_DISCLAIMER}</p></div>; }

