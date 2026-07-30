import assert from "node:assert/strict";
import test from "node:test";
import { sarvamFetch, SarvamRequestError, ProviderUnavailableError } from "../lib/sarvam-server";

test("sarvamFetch throws SarvamRequestError when response.ok is false", async (t) => {
  // Store original environment variables to clean up later
  const originalApiKey = process.env.SARVAM_API_KEY;
  const originalBaseUrl = process.env.SARVAM_API_BASE_URL;

  try {
    // Set environment variables for the test
    process.env.SARVAM_API_KEY = "test_key";
    process.env.SARVAM_API_BASE_URL = "https://test.api.sarvam.ai";

    // Mock global fetch to return an unsuccessful response (e.g. 400 Bad Request)
    t.mock.method(globalThis, "fetch", async () => {
      return {
        ok: false,
        status: 400,
        text: async () => "Bad Request Error from Mock",
      };
    });

    // We expect the function to throw a SarvamRequestError
    await assert.rejects(
      async () => {
        await sarvamFetch("/test-path", {});
      },
      (error) => {
        // Assert the error is an instance of SarvamRequestError
        assert.ok(error instanceof SarvamRequestError, "Error should be a SarvamRequestError");

        // Assert the status and detail properties
        assert.equal(error.status, 400);
        assert.equal(error.detail, "Bad Request Error from Mock");

        // Return true to indicate the assertion passed
        return true;
      }
    );
  } finally {
    // Clean up environment variables
    if (originalApiKey !== undefined) {
      process.env.SARVAM_API_KEY = originalApiKey;
    } else {
      delete process.env.SARVAM_API_KEY;
    }

    if (originalBaseUrl !== undefined) {
      process.env.SARVAM_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.SARVAM_API_BASE_URL;
    }
  }
});
