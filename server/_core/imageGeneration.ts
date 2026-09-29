import { providerBaseUrl, providerFetch } from "./providerTransport";
/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

const IMAGE_REQUEST_TIMEOUT_MS = 30_000;
const IMAGE_MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const IMAGE_MAX_ENCODED_BYTES = 11 * 1024 * 1024;
const IMAGE_MAX_DECODED_BYTES = 8 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_MAX_MODELS = 100;
const IMAGE_MODEL_FIELD_MAX_LENGTH = 256;

// Default model for generated sites. "MODEL_GPT_IMAGE_2" is the forge images.v1
// enum for GPT Image 2 (id: gpt-image-2). If omitted, forge falls back to Gemini 2.5 Flash.
const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** Forge image model enum, e.g. "MODEL_GPT_IMAGE_2". Defaults to GPT Image 2. */
  model?: string;
  /** Generation quality, e.g. "medium" | "high". Defaults to "medium" for GPT Image 2. */
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function readBoundedResponse(response: Response): Promise<string> {
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
      if (totalBytes > IMAGE_MAX_RESPONSE_BYTES) {
        throw new Error("response too large");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function parseImageResponse(payload: unknown): { b64Json: string; mimeType: string } {
  if (!isRecord(payload) || !isRecord(payload.image)) {
    throw new Error("invalid response");
  }
  const b64Json = payload.image.b64Json;
  const mimeType = payload.image.mimeType;
  if (
    typeof b64Json !== "string" ||
    typeof mimeType !== "string" ||
    !IMAGE_MIME_TYPES.has(mimeType) ||
    b64Json.length > IMAGE_MAX_ENCODED_BYTES ||
    b64Json.length === 0 ||
    b64Json.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64Json)
  ) {
    throw new Error("invalid response");
  }

  const buffer = Buffer.from(b64Json, "base64");
  if (buffer.length === 0 || buffer.length > IMAGE_MAX_DECODED_BYTES) {
    throw new Error("invalid response");
  }
  return { b64Json, mimeType };
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = `${providerBaseUrl(ENV.forgeApiUrl)}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality =
    options.quality ?? (model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : undefined);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);
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
        prompt: options.prompt,
        original_images: options.originalImages || [],
        model,
        ...(quality ? { quality } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("request failed");

    let image: { b64Json: string; mimeType: string };
    try {
      const payload = JSON.parse(await readBoundedResponse(response));
      image = parseImageResponse(payload);
    } catch {
      throw new Error("invalid response");
    }
    const { b64Json, mimeType } = image;
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
    const { url } = await storagePut(
      `generated/${crypto.randomUUID()}.${extension}`,
      Buffer.from(b64Json, "base64"),
      mimeType,
    );
    return { url };
  } catch (error) {
    if (error instanceof Error && error.message === "invalid response") {
      throw new Error("Image generation returned an invalid response");
    }
    if (error instanceof Error && error.message === "request failed") {
      throw new Error("Image generation request failed");
    }
    if (error instanceof Error && error.message.startsWith("Image generation")) {
      throw error;
    }
    throw new Error("Image generation request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export type ImageModelInfo = {
  /** Forge model enum, e.g. "MODEL_GPT_IMAGE_2". Pass into generateImage({ model }). */
  model?: string;
  /** Stable model id, e.g. "gpt-image-2". */
  id?: string;
};

function parseImageModel(value: unknown): ImageModelInfo {
  if (!isRecord(value)) throw new Error("invalid response");
  const model = value.model;
  const id = value.id;
  if (model !== undefined && (typeof model !== "string" || model.trim().length === 0 || model.length > IMAGE_MODEL_FIELD_MAX_LENGTH)) {
    throw new Error("invalid response");
  }
  if (id !== undefined && (typeof id !== "string" || id.trim().length === 0 || id.length > IMAGE_MODEL_FIELD_MAX_LENGTH)) {
    throw new Error("invalid response");
  }
  if (model === undefined && id === undefined) throw new Error("invalid response");
  return { model: model as string | undefined, id: id as string | undefined };
}

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

/**
 * List the image models the internal ImageService currently supports.
 * Feed a returned `model` value into generateImage({ model }).
 */
export async function listImageModels(): Promise<ListImageModelsResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = `${providerBaseUrl(ENV.forgeApiUrl)}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/ListModels",
    baseUrl
  ).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);
  try {
    const response = await providerFetch(fullUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "connect-protocol-version": "1",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: "{}",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("request failed");
    let result: unknown;
    try {
      result = JSON.parse(await readBoundedResponse(response));
    } catch {
      throw new Error("invalid response");
    }
    if (!isRecord(result) || !Array.isArray(result.models) || result.models.length > IMAGE_MAX_MODELS) {
      throw new Error("invalid response");
    }
    const models = result.models.map(parseImageModel);
    return { models };
  } catch (error) {
    if (error instanceof Error && error.message === "invalid response") {
      throw new Error("Image model listing returned an invalid response");
    }
    throw new Error("Image model listing request failed");
  } finally {
    clearTimeout(timeout);
  }
}
