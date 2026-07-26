import { sarvamConfigured } from "@/lib/sarvam-server";

export const runtime = "edge";

export async function GET() {
  return Response.json({
    sarvam: sarvamConfigured(),
    samvaadRealtime: Boolean(
      process.env.SAMVAAD_GATEWAY_URL && process.env.SAMVAAD_GATEWAY_SHARED_SECRET,
    ),
    telephonyConfigured: Boolean(
      process.env.SARVAM_TELEPHONY_CONNECTION_ID &&
        process.env.SARVAM_TELEPHONY_AGENT_NUMBER,
    ),
    fallbackAvailable: true,
    primaryCapability: "voice-experience",
    stack: {
      speechToText: process.env.SARVAM_STT_MODEL || "saaras:v3",
      languageUnderstanding: process.env.SARVAM_CHAT_MODEL || "sarvam-30b",
      textToSpeech: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
      voiceAgent: process.env.SARVAM_AGENT_APP_ID ? "configured" : "composed",
      contentAgent: process.env.SARVAM_CONTENT_AGENT_APP_ID ? "configured" : "supporting",
      docAgent: process.env.SARVAM_DOC_AGENT_APP_ID ? "configured" : "optional",
    },
  });
}
