import assert from "node:assert/strict";
import test from "node:test";
import { ProviderUnavailableError } from "../lib/sarvam-server";

test("ProviderUnavailableError - default message", () => {
  const error = new ProviderUnavailableError();
  assert.equal(error.message, "Sarvam is not configured.");
  assert.equal(error.name, "ProviderUnavailableError");
  assert.ok(error instanceof Error);
  assert.ok(error instanceof ProviderUnavailableError);
});

test("ProviderUnavailableError - custom message", () => {
  const customMessage = "Custom unavailable message";
  const error = new ProviderUnavailableError(customMessage);
  assert.equal(error.message, customMessage);
  assert.equal(error.name, "ProviderUnavailableError");
  assert.ok(error instanceof Error);
  assert.ok(error instanceof ProviderUnavailableError);
});
