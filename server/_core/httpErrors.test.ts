import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiNotFound, safeHttpError } from "./httpErrors";
import { applyHttpSecurityHeaders } from "./httpSecurity";
let server: Server | undefined;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } });
async function appUrl() {
  const app = express();
  app.use((_req, res, next) => { applyHttpSecurityHeaders(res, false); next(); });
  app.use(express.json({ limit: 64 }));
  app.post("/api/echo", (_req, res) => res.json({ ok: true }));
  app.get("/api/failure", () => { throw new Error("private-secret-host-and-payload"); });
  app.use("/api", apiNotFound);
  app.use((_req, res) => res.type("html").send("<html>SPA</html>"));
  app.use(safeHttpError);
  server = createServer(app).listen(0, "127.0.0.1"); await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
describe("HTTP error boundary", () => {
  it.each([
    ["/api/echo", "{private", 400, "Invalid request body."],
    ["/api/echo", JSON.stringify({ private: "x".repeat(100) }), 413, "Request body is too large."],
    ["/api/failure", undefined, 500, "Request could not be completed."],
    ["/api/missing?token=private", undefined, 404, "API endpoint not found."],
  ])("returns safe JSON for %s", async (path, body, status, message) => {
    const response = await fetch(`${await appUrl()}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body });
    expect(response.status).toBe(status);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({ error: message });
  });
  it("preserves successful API routes and SPA navigation", async () => {
    const url = await appUrl();
    expect(await (await fetch(`${url}/api/echo`, { method: "POST" })).json()).toEqual({ ok: true });
    expect(await (await fetch(`${url}/history`)).text()).toBe("<html>SPA</html>");
  });
  it("delegates errors after headers were sent", () => {
    const next = vi.fn(); const error = new Error("private");
    safeHttpError(error, {} as never, { headersSent: true } as never, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
