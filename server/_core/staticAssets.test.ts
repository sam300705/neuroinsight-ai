import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerStaticAssets } from "./staticAssets";
let server: Server | undefined;
let directory: string | undefined;
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; }
  if (directory) { await rm(directory, { recursive: true, force: true }); directory = undefined; }
});
async function start() {
  directory = await mkdtemp(path.join(tmpdir(), "neuro-static-"));
  await mkdir(path.join(directory, "assets"));
  await writeFile(path.join(directory, "index.html"), "<!doctype html><title>Research workspace</title>");
  await writeFile(path.join(directory, "assets", "Analyse-12345678.js"), "export default true;");
  await writeFile(path.join(directory, "manifest.json"), "{}");
  const app = express(); registerStaticAssets(app, directory);
  server = createServer(app).listen(0, "127.0.0.1"); await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
describe("production SPA asset consistency", () => {
  it("serves fresh HTML on direct routes and index requests", async () => {
    const base = await start();
    for (const route of ["/", "/analyse", "/index.html"]) {
      const response = await fetch(base + route);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("text/html");
    }
  });
  it("caches hashed chunks immutably but never caches missing chunks or serves them HTML", async () => {
    const base = await start();
    const asset = await fetch(`${base}/assets/Analyse-12345678.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
    const missing = await fetch(`${base}/assets/Analyse-removed123.js`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(missing.headers.get("content-type")).toContain("text/plain");
    expect(await missing.text()).toBe("Asset not found.");
    const manifest = await fetch(`${base}/manifest.json`);
    expect(manifest.headers.get("cache-control")).toBe("no-store");
  });
});
