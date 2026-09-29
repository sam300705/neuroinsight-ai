const SAFE_ERROR_TYPES = new Set([
  "AbortError",
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError",
]);

/**
 * Returns bounded, non-sensitive failure metadata for operational logs.
 * Error messages, stacks, causes, provider payloads, and custom error names are
 * deliberately excluded because they can contain credentials or user data.
 */
export function safeErrorMetadata(error: unknown): { errorType: string } {
  if (!(error instanceof Error)) {
    return { errorType: "UnknownError" };
  }

  let name: string;
  try {
    name = error.name;
  } catch {
    return { errorType: "Error" };
  }

  return { errorType: SAFE_ERROR_TYPES.has(name) ? name : "Error" };
}
