const DEFAULT_BASE_URL = "https://api.sarvam.ai";

export class ProviderUnavailableError extends Error {
  constructor(message = "Sarvam is not configured.") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export class SarvamRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Sarvam request failed (${status}): ${detail}`);
    this.name = "SarvamRequestError";
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
    throw new SarvamRequestError(response.status, detail);
  }

  return response;
}

export function providerErrorResponse(error: unknown): Response {
  const unavailable = error instanceof ProviderUnavailableError;
  const providerFailure = error instanceof SarvamRequestError;
  const safeDetail = providerFailure
    ? error.detail.replace(/\s+/g, " ").slice(0, 240)
    : "";
  console.error(
    "Sarvam provider error:",
    error instanceof Error ? error.message : String(error),
  );
  return Response.json(
    {
      error: unavailable
        ? "Sarvam is not configured. Add SARVAM_API_KEY and retry."
        : providerFailure
          ? `Sarvam rejected this request (${error.status}). ${safeDetail}`
          : "Sarvam could not complete this request. Retry or use the disclosed fallback case.",
      code: unavailable ? "PROVIDER_NOT_CONFIGURED" : "PROVIDER_REQUEST_FAILED",
      providerStatus: providerFailure ? error.status : undefined,
    },
    { status: unavailable ? 503 : 502 },
  );
}
