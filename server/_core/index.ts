import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { csrfSameOriginGuard } from "./csrf";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { applyHttpSecurityHeaders, HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS, MAX_TRPC_BODY_SIZE, REQUEST_TIMEOUT_MS } from "./httpSecurity";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    applyHttpSecurityHeaders(response, process.env.NODE_ENV === "production");
    next();
  });
  // Original MRI bytes do not traverse this server. The bounded allowance supports only
  // consented derived PDF/Grad-CAM artifacts, whose server-side validator caps decoded bytes.
  app.use(express.json({ limit: MAX_TRPC_BODY_SIZE }));
  app.use(express.urlencoded({ limit: MAX_TRPC_BODY_SIZE, extended: true }));
  registerOAuthRoutes(app);
  app.use("/api/trpc", csrfSameOriginGuard);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}; closing HTTP server.`);
    server.close(error => process.exit(error ? 1 : 0));
    setTimeout(() => process.exit(1), REQUEST_TIMEOUT_MS).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(console.error);
