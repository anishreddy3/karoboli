const DEFAULT_BASE_URL = "https://api.sarvam.ai";

export class ProviderUnavailableError extends Error {
  constructor(message = "Sarvam is not configured.") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export function sarvamConfigured(): boolean {
  return Boolean(process.env.SARVAM_API_KEY);
}

export async function sarvamFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new ProviderUnavailableError();

  const baseUrl = (
    process.env.SARVAM_API_BASE_URL || DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  const headers = new Headers(init.headers);
  headers.set("api-subscription-key", key);

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(35_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`Sarvam request failed (${response.status}): ${detail}`);
  }

  return response;
}

export function providerErrorResponse(error: unknown): Response {
  const unavailable = error instanceof ProviderUnavailableError;
  console.error(error);
  return Response.json(
    {
      error: unavailable
        ? "Sarvam is not configured. Add SARVAM_API_KEY and retry."
        : "Sarvam could not complete this request. Retry or use the disclosed fallback case.",
      code: unavailable ? "PROVIDER_NOT_CONFIGURED" : "PROVIDER_REQUEST_FAILED",
    },
    { status: unavailable ? 503 : 502 },
  );
}

