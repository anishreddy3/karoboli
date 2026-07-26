import {
  providerErrorResponse,
  SarvamRequestError,
  sarvamFetch,
} from "@/lib/sarvam-server";

export const runtime = "edge";

function transcriptionForm(
  audio: File,
  mode: string,
  language: string,
) {
  const form = new FormData();
  form.set("file", audio, audio.name || "karoboli-recording.webm");
  form.set("model", process.env.SARVAM_STT_MODEL || "saaras:v3");
  form.set("mode", mode);
  form.set("language_code", language);
  return form;
}

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const audio = incoming.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "An audio recording is required." }, { status: 400 });
    }
    if (audio.size > 15 * 1024 * 1024) {
      return Response.json({ error: "Recording must be smaller than 15 MB." }, { status: 413 });
    }

    const requestedMode = incoming.get("mode")?.toString() || "codemix";
    const requestedLanguage =
      incoming.get("language")?.toString() || "unknown";
    let response: Response;

    try {
      response = await sarvamFetch("/speech-to-text", {
        method: "POST",
        body: transcriptionForm(audio, requestedMode, requestedLanguage),
      });
    } catch (error) {
      const retryable =
        error instanceof SarvamRequestError &&
        [400, 415, 422].includes(error.status) &&
        (requestedMode !== "transcribe" || requestedLanguage !== "unknown");
      if (!retryable) throw error;

      console.warn(
        `Retrying Saaras with auto-detection after provider status ${error.status}.`,
      );
      response = await sarvamFetch("/speech-to-text", {
        method: "POST",
        body: transcriptionForm(audio, "transcribe", "unknown"),
      });
    }
    const data = (await response.json()) as {
      request_id?: string;
      transcript?: string;
      language_code?: string;
      language_probability?: number;
    };

    if (!data.transcript) throw new Error("Sarvam returned an empty transcript.");

    let normalizedTranscript = data.transcript;
    if (incoming.get("purpose")?.toString() === "buyer") {
      try {
        const translatedResponse = await sarvamFetch("/speech-to-text", {
          method: "POST",
          body: transcriptionForm(audio, "translate", "unknown"),
        });
        const translated = (await translatedResponse.json()) as {
          transcript?: string;
        };
        if (translated.transcript) normalizedTranscript = translated.transcript;
      } catch (error) {
        console.warn(
          "Buyer translation channel unavailable; using original transcript:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return Response.json({
      ...data,
      normalized_transcript: normalizedTranscript,
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
