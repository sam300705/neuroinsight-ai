import express, { type Express } from "express";
import path from "node:path";

/** Cache only content-addressed assets. Never serve the app shell as JavaScript. */
export function registerStaticAssets(app: Express, distPath: string) {
  app.use(express.static(distPath, {
    index: false,
    setHeaders(res, filePath) {
      const relative = path.relative(distPath, filePath).split(path.sep).join("/");
      res.setHeader("Cache-Control", /^assets\/.+-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(relative)
        ? "public, max-age=31536000, immutable" : "no-store");
    },
  }));
  app.use("/assets", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).type("text/plain").send("Asset not found.");
  });
  app.get("/{*splat}", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(distPath, "index.html"), error => { if (error) next(error); });
  });
}
