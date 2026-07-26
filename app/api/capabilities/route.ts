import { sarvamConfigured } from "@/lib/sarvam-server";

export const runtime = "edge";

export async function GET() {
  const samvaadRealtime = Boolean(
    process.env.SAMVAAD_GATEWAY_URL &&
      process.env.SAMVAAD_GATEWAY_SHARED_SECRET,
  );
  return Response.json({
    sarvam: sarvamConfigured(),
    samvaadRealtime,
    fallbackAvailable: true,
    primaryCapability: "voice-experience",
    stack: {
      speechToText: process.env.SARVAM_STT_MODEL || "saaras:v3",
      languageUnderstanding: process.env.SARVAM_CHAT_MODEL || "sarvam-30b",
      textToSpeech: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
      voiceAgent: samvaadRealtime ? "streaming" : "composed",
      contentAgent: process.env.SARVAM_CONTENT_AGENT_APP_ID
        ? "configured"
        : "supporting",
      docAgent: process.env.SARVAM_DOC_AGENT_APP_ID
        ? "configured"
        : "optional",
    },
  });
}
