import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import About from "@/pages/About";
import Analyse from "@/pages/Analyse";
import History from "@/pages/History";
import Home from "@/pages/Home";
import Limitations from "@/pages/Limitations";
import Methodology from "@/pages/Methodology";
import NotFound from "@/pages/NotFound";
import Performance from "@/pages/Performance";
import Results from "@/pages/Results";
import { Route, Switch } from "wouter";
function Router() { return <AppShell><Switch><Route path="/" component={Home} /><Route path="/analyse" component={Analyse} /><Route path="/results" component={Results} /><Route path="/history" component={History} /><Route path="/methodology" component={Methodology} /><Route path="/performance" component={Performance} /><Route path="/limitations" component={Limitations} /><Route path="/about" component={About} /><Route component={NotFound} /></Switch></AppShell>; }
function App() { return <ErrorBoundary><LanguageProvider><AnalysisProvider><TooltipProvider><Toaster /><Router /></TooltipProvider></AnalysisProvider></LanguageProvider></ErrorBoundary>; }
export default App;

