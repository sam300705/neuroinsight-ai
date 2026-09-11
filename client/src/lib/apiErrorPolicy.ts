import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";

export function handleApiError(error: unknown, operation: "query" | "mutation", startLogin: () => void) {
  // Preserve the existing auth transition, but never log error payloads, causes,
  // stacks, query keys or request metadata in the browser console.
  if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) startLogin();
  console.error(operation === "query" ? "[API] Query failed." : "[API] Mutation failed.");
}
