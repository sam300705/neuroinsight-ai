import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ scans: { list: { invalidate: vi.fn() } } }),
  scans: {
    list: { useQuery: () => ({ data: { items: [], omittedCorruptRecords: 20, nextCursor: 11 }, isLoading: false }) },
    deleteOne: { useMutation: () => ({}) }, deleteAll: { useMutation: () => ({}) },
    getArtifactDownload: { useQuery: vi.fn() },
  },
} }));
import History from "./History";

describe("corrupt history page navigation", () => {
  it("keeps an enabled next button visible even when no valid rows remain", () => {
    const html = renderToStaticMarkup(createElement(History));
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0];
    expect(nav).toBeDefined();
    const buttons = nav!.match(/<button[\s\S]*?<\/button>/g)!;
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain('disabled=""');
    expect(buttons[1]).not.toContain("disabled=");
    expect(html).toContain('role="status"');
  });
});
