/**
 * Voice transcription helper using internal Speech-to-Text service
 *
 * Frontend implementation guide:
 * 1. Capture audio using MediaRecorder API
 * 2. Upload audio to storage (e.g., S3) to get URL
 * 3. Call transcription with the URL
 *
 * Example usage:
 * ```tsx
 * // Frontend component
 * const transcribeMutation = trpc.voice.transcribe.useMutation({
 *   onSuccess: (data) => {
 *     console.log(data.text); // Full transcription
 *     console.log(data.language); // Detected language
 *     console.log(data.segments); // Timestamped segments
 *   }
 * });
 *
 * // After uploading audio to storage
 * transcribeMutation.mutate({
 *   audioUrl: uploadedAudioUrl,
 *   language: 'en', // optional
 *   prompt: 'Transcribe the meeting' // optional
 * });
 * ```
 */
import { ENV } from "./env";
import { safeErrorMetadata } from "./safeError";

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const AUDIO_DOWNLOAD_TIMEOUT_MS = 10_000;
const TRANSCRIPTION_TIMEOUT_MS = 60_000;
const MAX_LANGUAGE_LENGTH = 16;
const MAX_PROMPT_LENGTH = 2_000;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
]);

export type TranscribeOptions = {
  audioUrl: string; // URL to the audio file (e.g., S3 URL)
  language?: string; // Optional: specify language code (e.g., "en", "es", "zh")
  prompt?: string; // Optional: custom prompt for the transcription
};

// Native Whisper API segment format
export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Native Whisper API response format
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse; // Return native Whisper API response directly

export type TranscriptionError = {
  error: string;
  code:
    | "FILE_TOO_LARGE"
    | "INVALID_FORMAT"
    | "TRANSCRIPTION_FAILED"
    | "UPLOAD_FAILED"
    | "SERVICE_ERROR";
  details?: string;
};

const transcriptionError = (
  error: string,
  code: TranscriptionError["code"],
  details?: string
): TranscriptionError => ({ error, code, ...(details ? { details } : {}) });

const allowedAudioHosts = (): Set<string> =>
  new Set(
    ENV.voiceAudioAllowedHosts
      .split(",")
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
  );

const validatedAudioUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    const hosts = allowedAudioHosts();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      hosts.size === 0 ||
      !hosts.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

const normalizedAudioType = (value: string | null): string =>
  value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";

const readBoundedAudio = async (response: Response): Promise<Buffer> => {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_AUDIO_BYTES
    ) {
      throw new RangeError("Audio response exceeds the maximum size.");
    }
  }

  if (!response.body) {
    throw new TypeError("Audio response has no body.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_AUDIO_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError("Audio response exceeds the maximum size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(
    chunks.map(chunk => Buffer.from(chunk)),
    received
  );
};

/**
 * Transcribe audio to text using the internal Speech-to-Text service
 *
 * @param options - Audio data and metadata
 * @returns Transcription result or error
 */
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    // Step 1: Validate environment configuration
    if (!ENV.forgeApiUrl) {
      return transcriptionError(
        "Voice transcription service is not configured",
        "SERVICE_ERROR"
      );
    }
    if (!ENV.forgeApiKey) {
      return transcriptionError(
        "Voice transcription service authentication is missing",
        "SERVICE_ERROR"
      );
    }

    // Step 2: Download audio from URL
    const audioUrl = validatedAudioUrl(options.audioUrl);
    if (!audioUrl) {
      return transcriptionError("Audio URL is not permitted", "INVALID_FORMAT");
    }
    if (
      (options.language?.length ?? 0) > MAX_LANGUAGE_LENGTH ||
      (options.prompt?.length ?? 0) > MAX_PROMPT_LENGTH
    ) {
      return transcriptionError(
        "Transcription options exceed the allowed size",
        "INVALID_FORMAT"
      );
    }

    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(audioUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(AUDIO_DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) {
        return transcriptionError(
          "Failed to download audio file",
          "INVALID_FORMAT",
          `HTTP ${response.status}`
        );
      }

      mimeType = normalizedAudioType(response.headers.get("content-type"));
      if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
        return transcriptionError(
          "Audio file type is not supported",
          "INVALID_FORMAT"
        );
      }

      audioBuffer = await readBoundedAudio(response);
    } catch (error) {
      if (error instanceof RangeError) {
        return transcriptionError(
          "Audio file exceeds maximum size limit",
          "FILE_TOO_LARGE"
        );
      }
      const { errorType } = safeErrorMetadata(error);
      return transcriptionError(
        "Failed to fetch audio file",
        "SERVICE_ERROR",
        `Failure type: ${errorType}`
      );
    }

    // Step 3: Create FormData for multipart upload to Whisper API
    const formData = new FormData();

    // Create a Blob from the buffer and append to form
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
      type: mimeType,
    });
    formData.append("file", audioBlob, filename);

    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    // Add prompt - use custom prompt if provided, otherwise generate based on language
    const prompt =
      options.prompt ||
      (options.language
        ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
        : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);

    // Step 4: Call the transcription service
    const baseUrl = ENV.forgeApiUrl.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;

    const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });

    if (!response.ok) {
      return transcriptionError(
        "Transcription service request failed",
        "TRANSCRIPTION_FAILED",
        `HTTP ${response.status}`
      );
    }

    // Step 5: Parse and return the transcription result
    const whisperResponse = (await response.json()) as WhisperResponse;

    // Validate response structure
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return transcriptionError(
        "Invalid transcription response",
        "SERVICE_ERROR"
      );
    }

    return whisperResponse; // Return native Whisper API response directly
  } catch (error) {
    // Handle unexpected errors
    const { errorType } = safeErrorMetadata(error);
    return transcriptionError(
      "Voice transcription failed",
      "SERVICE_ERROR",
      `Failure type: ${errorType}`
    );
  }
}

/**
 * Helper function to get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
  };

  return mimeToExt[mimeType] || "audio";
}

/**
 * Helper function to get full language name from ISO code
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
    nl: "Dutch",
    pl: "Polish",
    tr: "Turkish",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
  };

  return langMap[langCode] || langCode;
}

/**
 * Example tRPC procedure implementation:
 *
 * ```ts
 * // In server/routers.ts
 * import { transcribeAudio } from "./_core/voiceTranscription";
 *
 * export const voiceRouter = router({
 *   transcribe: protectedProcedure
 *     .input(z.object({
 *       audioUrl: z.string(),
 *       language: z.string().optional(),
 *       prompt: z.string().optional(),
 *     }))
 *     .mutation(async ({ input, ctx }) => {
 *       const result = await transcribeAudio(input);
 *
 *       // Check if it's an error
 *       if ('error' in result) {
 *         throw new TRPCError({
 *           code: 'BAD_REQUEST',
 *           message: result.error,
 *           cause: result,
 *         });
 *       }
 *
 *       // Optionally save transcription to database
 *       await db.insert(transcriptions).values({
 *         userId: ctx.user.id,
 *         text: result.text,
 *         duration: result.duration,
 *         language: result.language,
 *         audioUrl: input.audioUrl,
 *         createdAt: new Date(),
 *       });
 *
 *       return result;
 *     }),
 * });
 * ```
 */
