import { providerBaseUrl, providerFetch } from "./providerTransport";
/**
 * Quick example (matches curl usage):
 *   await callDataApi("Youtube/search", {
 *     query: { gl: "US", hl: "en", q: "manus" },
 *   })
 */
import { ENV } from "./env";

const DATA_API_TIMEOUT_MS = 10_000;
const DATA_API_MAX_RESPONSE_BYTES = 1_048_576;

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
      if (totalBytes > DATA_API_MAX_RESPONSE_BYTES) throw new Error("response too large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
};

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = `${providerBaseUrl(ENV.forgeApiUrl)}/`;
  const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATA_API_TIMEOUT_MS);

  try {
    const response = await providerFetch(fullUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "connect-protocol-version": "1",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        apiId,
        query: options.query,
        body: options.body,
        path_params: options.pathParams,
        multipart_form_data: options.formData,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Data API request failed (${response.status})`);

    let payload: unknown;
    try {
      payload = JSON.parse(await readBoundedResponse(response));
    } catch {
      throw new Error("Data API returned an invalid response");
    }

    if (!isRecord(payload)) throw new Error("Data API returned an invalid response");
    if ("jsonData" in payload) {
      if (typeof payload.jsonData !== "string") throw new Error("Data API returned an invalid response");
      try {
        return JSON.parse(payload.jsonData);
      } catch {
        throw new Error("Data API returned an invalid response");
      }
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Data API ")) throw error;
    throw new Error("Data API request failed");
  } finally {
    clearTimeout(timeout);
  }
}
