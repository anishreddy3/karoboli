import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sarvamFetch,
  ProviderUnavailableError,
} from "../lib/sarvam-server";

describe("sarvam-server", () => {
  describe("sarvamFetch", () => {
    test("throws ProviderUnavailableError when SARVAM_API_KEY is not set", async () => {
      const originalKey = process.env.SARVAM_API_KEY;
      delete process.env.SARVAM_API_KEY;

      try {
        await assert.rejects(
          async () => {
            await sarvamFetch("/test", {});
          },
          (err) => {
            assert(err instanceof ProviderUnavailableError);
            assert.strictEqual(err.message, "Sarvam is not configured.");
            assert.strictEqual(err.name, "ProviderUnavailableError");
            return true;
          }
        );
      } finally {
        if (originalKey !== undefined) {
          process.env.SARVAM_API_KEY = originalKey;
        }
      }
    });
  });
});
