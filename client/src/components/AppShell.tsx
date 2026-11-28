import { BrainCircuit, Languages, Menu, ShieldCheck, X } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAnalysis } from "@/contexts/AnalysisContext";

const referenceLinks = [
  { href: "/methodology", key: "methodology" },
  { href: "/performance", key: "performance" },
  { href: "/limitations", key: "limitations" },
  { href: "/responsible-use", key: "responsible" },
  { href: "/about", key: "about" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const { current } = useAnalysis();
  const { language, setLanguage, t } = useLanguage();
  const nav = [
    { href: "/", key: "home" },
    { href: "/analyse", key: "analyze" },
    ...(current || location === "/results"
      ? [{ href: "/results", key: "results" } as const]
      : []),
    { href: "/history", key: "history" },
  ] as const;

  return (
    <div className="workspace-shell">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-b-lg bg-[var(--workspace-accent)] px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-0"
      >
        {t("skip")}
      </a>
      <header
        className="sticky top-0 z-40 pt-3 lg:pt-7"
        onKeyDown={event => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            menuToggle.current?.focus();
          }
        }}
      >
        <div className="workspace-wrap workspace-glass relative flex min-h-14 items-center justify-between gap-3 px-3 sm:px-6 lg:px-9">
          <Link
            href="/"
            aria-label="NeuroInsight AI"
            className="flex shrink-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--workspace-accent)]"
            onClick={() => setOpen(false)}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--workspace-accent)] text-[var(--viewer-ink)]">
              <BrainCircuit className="size-5" aria-hidden="true" />
            </span>
            <span>
              NeuroInsight{" "}
              <span className="text-[var(--workspace-accent)]">AI</span>
            </span>
          </Link>
          <nav
            id="workspace-nav"
            aria-label={t("navigation")}
            className={`${open ? "workspace-mobile-menu flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-1 border-b border-slate-200 bg-white p-4 shadow-sm md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          >
            {nav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={location === item.href ? "page" : undefined}
                className="workspace-nav-link rounded-lg px-3 py-2 text-sm font-semibold text-[var(--workspace-muted)] hover:bg-[var(--workspace-soft)]"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "hi" : "en")}
              aria-label={t("switchLanguage")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--workspace-soft)] focus-visible:outline-2 focus-visible:outline-[var(--workspace-accent)]"
            >
              <Languages
                className="hidden size-4 sm:block"
                aria-hidden="true"
              />
              {t("language")}
            </button>
            <button
              type="button"
              ref={menuToggle}
              onClick={() => setOpen(value => !value)}
              aria-expanded={open}
              aria-controls="workspace-nav"
              aria-label={t("toggleNavigation")}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 focus-visible:outline-2 focus-visible:outline-[var(--workspace-accent)] md:hidden"
            >
              {open ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="workspace-wrap py-5 focus:outline-none lg:py-8"
      >
        <div className="workspace-reference">{children}</div>
      </main>
      <footer className="workspace-wrap pb-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-slate-200 pt-5">
          <p className="flex items-center gap-2 text-xs leading-5 text-slate-600">
            <ShieldCheck
              className="size-4 shrink-0 text-[var(--workspace-accent)]"
              aria-hidden="true"
            />
            {t("academic")}
          </p>
          <nav
            aria-label={
              language === "hi" ? "शोध संदर्भ" : "Research references"
            }
            className="flex flex-wrap gap-x-4 gap-y-2"
          >
            {referenceLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-sm text-xs font-semibold text-slate-600 hover:text-[var(--workspace-accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--workspace-accent)]"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
