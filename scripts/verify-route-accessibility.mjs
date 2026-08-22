import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";
const routes = ["/", "/analyse", "/results", "/history", "/methodology", "/performance", "/limitations", "/about"];

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext();
  for (const route of routes) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    if (audit.violations.length) {
      const summary = audit.violations.map(item => `${item.id}: ${item.help} [${item.nodes.map(node => `${node.target.join(" ")}: ${node.failureSummary ?? ""}`).join(" | ")}]`).join("; ");
      throw new Error(`Accessibility violations on ${route}: ${summary}`);
    }
    await page.close();
  }
  await context.close();
  console.log("Cross-route accessibility audit passed: WCAG 2 A/AA axe checks and keyboard skip-link focus passed on all primary routes.");
} finally {
  await browser.close();
}
