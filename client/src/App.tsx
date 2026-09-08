import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Home from "@/pages/Home";
import { lazy, Suspense } from "react";
import { retryRouteImport } from "@/lib/routeImport";
import { Route, Switch } from "wouter";

const Analyse = lazy(() => retryRouteImport(() => import("@/pages/Analyse")));
const Results = lazy(() => retryRouteImport(() => import("@/pages/Results")));
const History = lazy(() => retryRouteImport(() => import("@/pages/History")));
const Methodology = lazy(() => retryRouteImport(() => import("@/pages/Methodology")));
const Performance = lazy(() => retryRouteImport(() => import("@/pages/Performance")));
const Limitations = lazy(() => retryRouteImport(() => import("@/pages/Limitations")));
const About = lazy(() => retryRouteImport(() => import("@/pages/About")));
const ResponsibleUse = lazy(() => retryRouteImport(() => import("@/pages/ResponsibleUse")));
const NotFound = lazy(() => retryRouteImport(() => import("@/pages/NotFound")));

function RouteLoading() {
  return <div className="mx-auto max-w-6xl px-4 py-10" role="status" aria-live="polite"><p className="text-sm text-slate-600">Loading research workspace…</p></div>;
}

function Router() { return <AppShell><Suspense fallback={<RouteLoading />}><Switch><Route path="/" component={Home} /><Route path="/analyse" component={Analyse} /><Route path="/results" component={Results} /><Route path="/history" component={History} /><Route path="/methodology" component={Methodology} /><Route path="/performance" component={Performance} /><Route path="/limitations" component={Limitations} /><Route path="/responsible-use" component={ResponsibleUse} /><Route path="/about" component={About} /><Route component={NotFound} /></Switch></Suspense></AppShell>; }
function App() { return <ErrorBoundary><LanguageProvider><AnalysisProvider><TooltipProvider><Toaster /><Router /></TooltipProvider></AnalysisProvider></LanguageProvider></ErrorBoundary>; }
export default App;
