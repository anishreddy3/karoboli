import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";

export const runtime = "edge";

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

    const form = new FormData();
    form.set("file", audio, audio.name || "karoboli-recording.webm");
    form.set("model", process.env.SARVAM_STT_MODEL || "saaras:v3");
    form.set("mode", incoming.get("mode")?.toString() || "codemix");
    form.set("language_code", incoming.get("language")?.toString() || "unknown");

    const response = await sarvamFetch("/speech-to-text", {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as {
      request_id?: string;
      transcript?: string;
      language_code?: string;
      language_probability?: number;
    };

    if (!data.transcript) throw new Error("Sarvam returned an empty transcript.");
    return Response.json(data);
  } catch (error) {
    return providerErrorResponse(error);
  }
}

