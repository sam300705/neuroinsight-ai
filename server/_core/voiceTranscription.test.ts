import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { transcribeAudio } from "./voiceTranscription";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;
const originalAllowedHosts = ENV.voiceAudioAllowedHosts;

const audioHeaders = { "content-type": "audio/mpeg" };

describe("voice transcription network boundary", () => {
  beforeEach(() => {
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "test-only-key";
    ENV.voiceAudioAllowedHosts = "objects.example";
  });

  afterEach(() => {
    ENV.forgeApiUrl = originalForgeUrl;
    ENV.forgeApiKey = originalForgeKey;
    ENV.voiceAudioAllowedHosts = originalAllowedHosts;
    vi.unstubAllGlobals();
  });

  it.each([
    "http://objects.example/audio.mp3",
    "https://user:password@objects.example/audio.mp3",
    "https://127.0.0.1/audio.mp3",
    "https://metadata.internal/audio.mp3",
    "not a URL",
  ])(
    "rejects an untrusted audio URL before making a request: %s",
    async audioUrl => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(transcribeAudio({ audioUrl })).resolves.toMatchObject({
        error: "Audio URL is not permitted",
        code: "INVALID_FORMAT",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("requires an explicit owner-configured download host", async () => {
    ENV.voiceAudioAllowedHosts = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeAudio({ audioUrl: "https://objects.example/audio.mp3" })
    ).resolves.toMatchObject({ code: "INVALID_FORMAT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared response before consuming its body", async () => {
    const response = new Response("private audio", {
      headers: {
        ...audioHeaders,
        "content-length": String(16 * 1024 * 1024 + 1),
      },
    });
    const bodyReader = vi.spyOn(response.body!, "getReader");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      transcribeAudio({ audioUrl: "https://objects.example/audio.mp3" })
    ).resolves.toEqual({
      error: "Audio file exceeds maximum size limit",
      code: "FILE_TOO_LARGE",
    });
    expect(bodyReader).not.toHaveBeenCalled();
  });

  it("stops a chunked response when the streamed byte limit is crossed", async () => {
    const oversizedChunk = new Uint8Array(16 * 1024 * 1024 + 1);
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(oversizedChunk);
          controller.close();
        },
      }),
      { headers: audioHeaders }
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      transcribeAudio({ audioUrl: "https://objects.example/audio.mp3" })
    ).resolves.toEqual({
      error: "Audio file exceeds maximum size limit",
      code: "FILE_TOO_LARGE",
    });
  });

  it("does not expose a failed download's exception message", async () => {
    const privateDetail = "signed-url=private";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError(privateDetail))
    );

    const result = await transcribeAudio({
      audioUrl: "https://objects.example/audio.mp3",
    });

    expect(result).toEqual({
      error: "Failed to fetch audio file",
      code: "SERVICE_ERROR",
      details: "Failure type: TypeError",
    });
    expect(JSON.stringify(result)).not.toContain(privateDetail);
  });

  it("does not follow redirects or expose download response text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("signed URL or private provider detail", {
        status: 302,
        statusText: "private reason",
        headers: { location: "http://127.0.0.1/private" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio({
      audioUrl: "https://objects.example/audio.mp3",
    });

    expect(result).toEqual({
      error: "Failed to download audio file",
      code: "INVALID_FORMAT",
      details: "HTTP 302",
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("127.0.0.1");
  });

  it("rejects unsupported content before uploading it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>not audio</html>", {
        headers: { "content-type": "text/html" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeAudio({ audioUrl: "https://objects.example/audio.mp3" })
    ).resolves.toMatchObject({
      error: "Audio file type is not supported",
      code: "INVALID_FORMAT",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses bounded downloads/uploads and omits provider failure bodies", async () => {
    const providerBody = "authorization=Bearer private";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("audio", { headers: audioHeaders }))
      .mockResolvedValueOnce(
        new Response(providerBody, {
          status: 503,
          statusText: "private reason",
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio({
      audioUrl: "https://objects.example/audio.mp3",
    });

    expect(result).toEqual({
      error: "Transcription service request failed",
      code: "TRANSCRIPTION_FAILED",
      details: "HTTP 503",
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
    expect(JSON.stringify(result)).not.toContain(providerBody);
    expect(JSON.stringify(result)).not.toContain("private reason");
  });

  it("returns a valid transcription from an allowed audio object", async () => {
    const transcription = {
      task: "transcribe" as const,
      language: "en",
      duration: 1,
      text: "synthetic test audio",
      segments: [],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("audio", { headers: audioHeaders }))
        .mockResolvedValueOnce(Response.json(transcription))
    );

    await expect(
      transcribeAudio({ audioUrl: "https://objects.example/audio.mp3" })
    ).resolves.toEqual(transcription);
  });
});
