import {
  ArrowRight,
  BrainCircuit,
  FileCheck2,
  Layers3,
  ShieldAlert,
} from "lucide-react";
import { Link } from "wouter";
import { AcademicDisclaimer } from "@/components/ResearchDisclaimers";
import { copyFor } from "@/contexts/pageCopy";
import { useLanguage } from "@/contexts/LanguageContext";

const featureIcons = [Layers3, BrainCircuit, ShieldAlert, FileCheck2];

export default function Home() {
  const { language } = useLanguage();
  const text = copyFor(language).home;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="grid overflow-hidden rounded-3xl bg-slate-950 text-white shadow-lg lg:grid-cols-[1.15fr_1fr]">
        <div className="bg-[radial-gradient(ellipse_at_bottom_left,_#134e4a,_transparent_72%)] p-6 sm:p-10">
          <p className="text-sm font-medium text-teal-200">{text.eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            {text.title}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">
            {text.intro}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/analyse"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-teal-950 hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {text.begin} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/methodology"
              className="inline-flex items-center rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {text.methodology}
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-700 bg-slate-900 p-6 sm:p-8 lg:border-t-0 lg:border-l">
          <h2 className="font-semibold text-teal-200">{text.journeyTitle}</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 marker:font-mono marker:text-teal-200">
            {text.journey.map(([title, detail]) => (
              <li
                key={title}
                className="border-b border-slate-700 pb-3 pl-2 last:border-b-0 last:pb-0"
              >
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-300">
                  {detail}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <AcademicDisclaimer />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {text.features.map(([title, detail], index) => {
          const Icon = featureIcons[index]!;
          return (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <Icon className="size-5 text-teal-800" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
            </article>
          );
        })}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">{text.modelTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {text.modelDetail}
          </p>
          <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-950">
            <strong className="block">{text.evidenceLabel}</strong>
            {text.evidenceDetail}
          </p>
          <Link
            href="/performance"
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {text.evidence} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-950">
            {text.cannotTitle}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
            {text.cannot.map(item => (
              <li key={item} className="flex gap-2">
                <ShieldAlert
                  className="mt-1 size-4 shrink-0"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
