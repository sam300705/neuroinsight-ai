import { providerBaseUrl, providerFetch } from "./providerTransport";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type HeartbeatJob = {
  name: string;
  /**
   * 6-field cron with seconds (`sec min hour dom mon dow`), UTC, min interval 60s.
   * Use `0` for the seconds field — e.g. `"0 0 9 * * *"` is daily 09:00 UTC.
   * See /home/ubuntu/skills/webdev-periodic-updates/SKILL.md.
   */
  cron: string;
  /** Callback path. MUST start with `/api/scheduled/`. */
  path: string;
  method?: "POST" | "PUT";
  payload?: unknown;
  description?: string;
};

/**
 * Update patch. All fields optional; unset = leave unchanged.
 * `enable`: true = resume, false = pause; omit = unchanged.
 * `name` is the (project, owner)-scope key and cannot be changed.
 */
export type HeartbeatJobUpdate = Partial<Omit<HeartbeatJob, "name">> & {
  enable?: boolean;
};

export type HeartbeatJobInfo = {
  taskUid: string;
  name: string;
  userId: string;
  description: string;
  cronExpression: string;
  callbackPath: string;
  callbackMethod: string;
  callbackPayload: string;
  isEnable: boolean;
  createdAt?: string | null;
  lastExecutedAt?: string | null;
  nextExecutionAt?: string | null;
};

const SERVICE = "webdevtoken.v1.WebDevService";
const HEARTBEAT_TIMEOUT_MS = 10_000;
const HEARTBEAT_MAX_RESPONSE_BYTES = 512 * 1024;
const HEARTBEAT_MAX_REQUEST_BYTES = 128 * 1024;
const HEARTBEAT_MAX_PAYLOAD_BYTES = 64 * 1024;
const HEARTBEAT_MAX_JOBS = 100;
const HEARTBEAT_MAX_SESSION_LENGTH = 2048;
const HEARTBEAT_MAX_NAME_LENGTH = 128;
const HEARTBEAT_MAX_CRON_LENGTH = 128;
const HEARTBEAT_MAX_PATH_LENGTH = 1024;
const HEARTBEAT_MAX_DESCRIPTION_LENGTH = 2048;
const HEARTBEAT_MAX_TASK_UID_LENGTH = 256;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLength;

const badRequest = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};

const buildEndpoint = (rpc: string): string => {
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Heartbeat service URL is not configured (BUILT_IN_FORGE_API_URL).",
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Heartbeat service API key is not configured (BUILT_IN_FORGE_API_KEY).",
    });
  }
  try {
    const baseUrl = providerBaseUrl(ENV.forgeApiUrl);
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL(`${SERVICE}/${rpc}`, normalizedBase).toString();
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service URL is invalid.",
    });
  }
};

const readBoundedResponse = async (response: Response): Promise<string> => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      totalBytes += value.byteLength;
      if (totalBytes > HEARTBEAT_MAX_RESPONSE_BYTES) {
        throw new Error("response too large");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
};

const discardResponse = async (response: Response): Promise<void> => {
  await response.body?.cancel().catch(() => undefined);
};

const callForge = async <T>(
  rpc: string,
  body: Record<string, unknown>,
  userSession: string
): Promise<T> => {
  const endpoint = buildEndpoint(rpc);
  if (
    typeof userSession !== "string" ||
    userSession.length > HEARTBEAT_MAX_SESSION_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(userSession)
  ) {
    badRequest("heartbeat session is invalid");
  }
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${ENV.forgeApiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1",
  };
  // userSession is the decoded `app_session_id` cookie value (NOT the raw
  // Cookie header). Empty string falls back to the project owner identity.
  if (userSession) {
    headers["x-manus-user-session"] = userSession;
  }

  const requestBody = (() => {
    try {
      return JSON.stringify(body);
    } catch {
      return badRequest("heartbeat request is invalid");
    }
  })();
  if (Buffer.byteLength(requestBody, "utf8") > HEARTBEAT_MAX_REQUEST_BYTES) {
    badRequest("heartbeat request is too large");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    const response = await providerFetch(endpoint, {
      method: "POST",
      headers,
      body: requestBody,
      signal: controller.signal,
    });
    if (!response.ok) {
      await discardResponse(response);
      throw mapForgeError(response.status, rpc);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(await readBoundedResponse(response));
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Heartbeat ${rpc} returned an invalid response`,
      });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Heartbeat ${rpc} request failed`,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const mapForgeError = (status: number, rpc: string): TRPCError => {
  let code: TRPCError["code"] = "INTERNAL_SERVER_ERROR";
  if (status === 401) code = "UNAUTHORIZED";
  else if (status === 403) code = "FORBIDDEN";
  else if (status === 404) code = "NOT_FOUND";
  else if (status === 400 || status === 422) code = "BAD_REQUEST";
  else if (status === 409) code = "CONFLICT";
  else if (status === 429) code = "TOO_MANY_REQUESTS";
  return new TRPCError({
    code,
    message: `Heartbeat ${rpc} failed (${status})`,
  });
};

const stringifyPayload = (payload: unknown): string => {
  const value = (() => {
    try {
      return payload === undefined || payload === null
        ? "{}"
        : typeof payload === "string"
          ? payload
          : JSON.stringify(payload);
    } catch {
      return badRequest("callback payload is invalid");
    }
  })();
  if (Buffer.byteLength(value, "utf8") > HEARTBEAT_MAX_PAYLOAD_BYTES) {
    badRequest("callback payload is too large");
  }
  return value;
};

const validateCallbackPath = (path: string): void => {
  if (
    !isNonEmptyString(path, HEARTBEAT_MAX_PATH_LENGTH) ||
    !/^\/api\/scheduled\/[A-Za-z0-9._~/-]+$/.test(path) ||
    path.split("/").some(segment => segment === "." || segment === "..")
  ) {
    badRequest("callback path must be a safe /api/scheduled/ path");
  }
};

const validateMethod = (method: unknown): void => {
  if (method !== undefined && method !== "POST" && method !== "PUT") {
    badRequest("heartbeat callback method is invalid");
  }
};

const validateCron = (cron: string): void => {
  if (!isNonEmptyString(cron, HEARTBEAT_MAX_CRON_LENGTH)) {
    badRequest("cron expression is invalid");
  }
  const fields = cron.trim().split(/\s+/);
  if (
    fields.length !== 6 ||
    fields[0] !== "0" ||
    fields.some(field => !/^[0-9A-Za-z*?,/\-]+$/.test(field))
  ) {
    badRequest("cron expression must contain six safe fields and use second 0");
  }
};

const validateName = (name: string): void => {
  if (
    !isNonEmptyString(name, HEARTBEAT_MAX_NAME_LENGTH) ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    badRequest("heartbeat name is invalid");
  }
};

const validateDescription = (description: string | undefined): void => {
  if (
    description !== undefined &&
    (typeof description !== "string" ||
      description.length > HEARTBEAT_MAX_DESCRIPTION_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(description))
  ) {
    badRequest("heartbeat description is invalid");
  }
};

const validateTaskUid = (taskUid: string): void => {
  if (
    !isNonEmptyString(taskUid, HEARTBEAT_MAX_TASK_UID_LENGTH) ||
    /[\u0000-\u001f\u007f]/.test(taskUid)
  ) {
    badRequest("heartbeat task identifier is invalid");
  }
};

const optionalDate = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || isNonEmptyString(value, 128);

const parseMutationResponse = (value: unknown, requireTaskUid: boolean) => {
  if (!isRecord(value) || !optionalDate(value.nextExecutionAt)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service returned an invalid response",
    });
  }
  if (
    requireTaskUid &&
    !isNonEmptyString(value.taskUid, HEARTBEAT_MAX_TASK_UID_LENGTH)
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service returned an invalid response",
    });
  }
  return {
    ...(requireTaskUid ? { taskUid: value.taskUid as string } : {}),
    ...(value.nextExecutionAt !== undefined
      ? { nextExecutionAt: value.nextExecutionAt as string | null }
      : {}),
  };
};

const parseHeartbeatJob = (value: unknown): HeartbeatJobInfo => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.taskUid, HEARTBEAT_MAX_TASK_UID_LENGTH) ||
    !isNonEmptyString(value.name, HEARTBEAT_MAX_NAME_LENGTH) ||
    !isNonEmptyString(value.userId, 256) ||
    typeof value.description !== "string" ||
    value.description.length > HEARTBEAT_MAX_DESCRIPTION_LENGTH ||
    !isNonEmptyString(value.cronExpression, HEARTBEAT_MAX_CRON_LENGTH) ||
    !isNonEmptyString(value.callbackPath, HEARTBEAT_MAX_PATH_LENGTH) ||
    (value.callbackMethod !== "POST" && value.callbackMethod !== "PUT") ||
    typeof value.callbackPayload !== "string" ||
    Buffer.byteLength(value.callbackPayload, "utf8") >
      HEARTBEAT_MAX_PAYLOAD_BYTES ||
    typeof value.isEnable !== "boolean" ||
    !optionalDate(value.createdAt) ||
    !optionalDate(value.lastExecutedAt) ||
    !optionalDate(value.nextExecutionAt)
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service returned an invalid response",
    });
  }
  return value as unknown as HeartbeatJobInfo;
};

/**
 * Create a new HTTP cron job. Returns the assigned `taskUid` to persist on
 * your business row so callbacks can dereference it.
 */
export async function createHeartbeatJob(
  job: HeartbeatJob,
  userSession: string
): Promise<{ taskUid: string; nextExecutionAt?: string | null }> {
  validateName(job.name);
  validateCron(job.cron);
  validateCallbackPath(job.path);
  validateMethod(job.method);
  validateDescription(job.description);
  const result = await callForge<unknown>(
    "CreateHeartbeatJob",
    {
      name: job.name,
      cronExpression: job.cron,
      callbackPath: job.path,
      callbackMethod: job.method ?? "POST",
      callbackPayload: stringifyPayload(job.payload),
      description: job.description ?? "",
    },
    userSession
  );
  return parseMutationResponse(result, true) as {
    taskUid: string;
    nextExecutionAt?: string | null;
  };
}

/**
 * Update an existing cron located by `taskUid`. Only fields you pass in
 * `patch` are mutated. `enable` flips resume/pause; omit to leave alone.
 */
export async function updateHeartbeatJob(
  taskUid: string,
  patch: HeartbeatJobUpdate,
  userSession: string
): Promise<{ nextExecutionAt?: string | null }> {
  validateTaskUid(taskUid);
  if (patch.cron !== undefined) validateCron(patch.cron);
  if (patch.path !== undefined) validateCallbackPath(patch.path);
  validateMethod(patch.method);
  validateDescription(patch.description);
  if (patch.enable !== undefined && typeof patch.enable !== "boolean") {
    badRequest("heartbeat enable flag is invalid");
  }
  const body: Record<string, unknown> = { taskUid };
  if (patch.cron !== undefined) body.cronExpression = patch.cron;
  if (patch.path !== undefined) body.callbackPath = patch.path;
  if (patch.method !== undefined) body.callbackMethod = patch.method;
  if (patch.payload !== undefined) {
    body.callbackPayload = stringifyPayload(patch.payload);
  }
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.enable !== undefined) body.enable = patch.enable;
  const result = await callForge<unknown>(
    "UpdateHeartbeatJob",
    body,
    userSession
  );
  return parseMutationResponse(result, false);
}

/** Delete a cron located by `taskUid`. Idempotent on caller side. */
export async function deleteHeartbeatJob(
  taskUid: string,
  userSession: string
): Promise<void> {
  validateTaskUid(taskUid);
  await callForge("DeleteHeartbeatJob", { taskUid }, userSession);
}

/**
 * List cron jobs owned by the resolved actor (end-user when `userSession`
 * is set, project owner otherwise) within the current project.
 *
 * `actorUserId` in the response echoes whose cron list you got back. End-users
 * cannot list other users' crons via this SDK; cross-user inspection is
 * owner-only via the sandbox CLI (`manus-heartbeat list --user-id <uid>`).
 */
export async function listHeartbeatJobs(
  userSession: string,
  pagination?: { page?: number; pageSize?: number }
): Promise<{ total: number; actorUserId: string; jobs: HeartbeatJobInfo[] }> {
  if (
    pagination?.page !== undefined &&
    (!Number.isInteger(pagination.page) || pagination.page < 1)
  ) {
    badRequest("heartbeat page must be a positive integer");
  }
  if (
    pagination?.pageSize !== undefined &&
    (!Number.isInteger(pagination.pageSize) ||
      pagination.pageSize < 1 ||
      pagination.pageSize > HEARTBEAT_MAX_JOBS)
  ) {
    badRequest("heartbeat page size is invalid");
  }
  const body: Record<string, unknown> = {};
  if (pagination?.page !== undefined) body.page = pagination.page;
  if (pagination?.pageSize !== undefined) body.pageSize = pagination.pageSize;
  const result = await callForge<unknown>(
    "ListHeartbeatJobs",
    body,
    userSession
  );
  if (
    !isRecord(result) ||
    !Number.isInteger(result.total) ||
    Number(result.total) < 0 ||
    !isNonEmptyString(result.actorUserId, 256) ||
    !Array.isArray(result.jobs) ||
    result.jobs.length > HEARTBEAT_MAX_JOBS
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service returned an invalid response",
    });
  }
  return {
    total: result.total as number,
    actorUserId: result.actorUserId,
    jobs: result.jobs.map(parseHeartbeatJob),
  };
}
