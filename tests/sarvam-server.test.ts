import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderUnavailableError,
  SarvamRequestError,
  providerErrorResponse,
  sarvamConfigured,
  sarvamFetch,
} from "../lib/sarvam-server";

function withEnv(
  values: Record<string, string | undefined>,
  run: () => Promise<void> | void,
) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("ProviderUnavailableError uses the default and custom messages", () => {
  const def = new ProviderUnavailableError();
  assert.equal(def.message, "Sarvam is not configured.");
  assert.equal(def.name, "ProviderUnavailableError");
  assert.ok(def instanceof Error);

  const custom = new ProviderUnavailableError("Custom unavailable message");
  assert.equal(custom.message, "Custom unavailable message");
});

test("sarvamConfigured reflects SARVAM_API_KEY presence", async () => {
  await withEnv({ SARVAM_API_KEY: "test_key" }, () => {
    assert.equal(sarvamConfigured(), true);
  });
  await withEnv({ SARVAM_API_KEY: undefined }, () => {
    assert.equal(sarvamConfigured(), false);
  });
  await withEnv({ SARVAM_API_KEY: "" }, () => {
    assert.equal(sarvamConfigured(), false);
  });
});

test("sarvamFetch throws ProviderUnavailableError when the API key is missing", async () => {
  await withEnv({ SARVAM_API_KEY: undefined }, async () => {
    await assert.rejects(
      () => sarvamFetch("/test", {}),
      (error: unknown) => {
        assert.ok(error instanceof ProviderUnavailableError);
        assert.equal(error.message, "Sarvam is not configured.");
        return true;
      },
    );
  });
});

test("sarvamFetch throws SarvamRequestError when response.ok is false", async (t) => {
  await withEnv(
    {
      SARVAM_API_KEY: "test_key",
      SARVAM_API_BASE_URL: "https://test.api.sarvam.ai",
    },
    async () => {
      t.mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 400,
        text: async () => "Bad Request Error from Mock",
      }));

      await assert.rejects(
        () => sarvamFetch("/test-path", {}),
        (error: unknown) => {
          assert.ok(error instanceof SarvamRequestError);
          assert.equal(error.status, 400);
          assert.equal(error.detail, "Bad Request Error from Mock");
          return true;
        },
      );
    },
  );
});

test("providerErrorResponse maps provider failures to safe API responses", async (t) => {
  t.mock.method(console, "error", () => {});

  const unavailable = providerErrorResponse(new ProviderUnavailableError());
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    error: "Sarvam is not configured. Add SARVAM_API_KEY and retry.",
    code: "PROVIDER_NOT_CONFIGURED",
  });

  const sanitized = providerErrorResponse(
    new SarvamRequestError(400, "Bad Request\n\n\n  Invalid    parameter."),
  );
  assert.equal(sanitized.status, 502);
  assert.deepEqual(await sanitized.json(), {
    error: "Sarvam rejected this request (400). Bad Request Invalid parameter.",
    code: "PROVIDER_REQUEST_FAILED",
    providerStatus: 400,
  });

  const longDetail = "A".repeat(300);
  const truncated = providerErrorResponse(new SarvamRequestError(429, longDetail));
  const truncatedBody = await truncated.json();
  assert.equal(truncated.status, 502);
  assert.equal(truncatedBody.code, "PROVIDER_REQUEST_FAILED");
  assert.equal(truncatedBody.providerStatus, 429);
  assert.ok(String(truncatedBody.error).includes("A".repeat(240)));
  assert.equal(String(truncatedBody.error).includes("A".repeat(241)), false);

  const generic = providerErrorResponse(new Error("Something went completely wrong"));
  assert.equal(generic.status, 502);
  assert.deepEqual(await generic.json(), {
    error:
      "Sarvam could not complete this request. Retry or use the disclosed fallback case.",
    code: "PROVIDER_REQUEST_FAILED",
  });

  const stringThrow = providerErrorResponse("Just a string error");
  assert.equal(stringThrow.status, 502);
  assert.equal(
    (await stringThrow.json()).code,
    "PROVIDER_REQUEST_FAILED",
  );
});
