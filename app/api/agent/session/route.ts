import { getChatGPTUser } from "@/app/chatgpt-auth";

export const runtime = "edge";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(signature));
}

export async function POST() {
  const gatewayUrl = process.env.SAMVAAD_GATEWAY_URL;
  const sharedSecret = process.env.SAMVAAD_GATEWAY_SHARED_SECRET;
  if (!gatewayUrl || !sharedSecret) {
    return Response.json(
      { error: "Samvaad realtime gateway is not configured." },
      { status: 503 },
    );
  }

  const user = await getChatGPTUser();
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const payload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        sub: user?.email || `demo-${crypto.randomUUID()}`,
        exp: expiresAt,
        nonce: crypto.randomUUID(),
      }),
    ),
  );
  const signature = await sign(payload, sharedSecret);

  return Response.json({
    gatewayUrl,
    token: `${payload}.${signature}`,
    expiresAt,
  });
}
