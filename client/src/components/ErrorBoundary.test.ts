import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorBoundary from "./ErrorBoundary";
describe("page failure recovery", () => {
  it("shows actionable recovery without raw error details", () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error("private-token-or-provider-url"));
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain("Reload Page");
    expect(html).toContain("unsaved analysis");
    expect(html).not.toContain("private-token-or-provider-url");
    expect(html).not.toContain("<pre");
  });
});
