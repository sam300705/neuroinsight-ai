import type { ErrorRequestHandler, RequestHandler } from "express";

/** Install after API routes and before the SPA fallback. */
export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
};

/** Install last. Never return parser bodies, URLs, stacks or upstream errors. */
export const safeHttpError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  const type = error?.type;
  const status = type === "entity.too.large" ? 413 :
    ["entity.parse.failed", "request.aborted", "request.size.invalid"].includes(type) ? 400 :
    ["encoding.unsupported", "charset.unsupported"].includes(type) ? 415 : 500;
  res.status(status).json({ error: status === 413 ? "Request body is too large." :
    status === 400 ? "Invalid request body." : status === 415 ? "Unsupported request encoding." :
    "Request could not be completed." });
};
