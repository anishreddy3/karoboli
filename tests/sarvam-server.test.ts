import assert from "node:assert/strict";
import test from "node:test";
import { providerErrorResponse, ProviderUnavailableError, SarvamRequestError } from "../lib/sarvam-server";

test("providerErrorResponse handles ProviderUnavailableError", async (t) => {
  t.mock.method(console, "error", () => {});

  const error = new ProviderUnavailableError();
  const response = providerErrorResponse(error);

  assert.equal(response.status, 503);

  const body = await response.json();
  assert.equal(body.code, "PROVIDER_NOT_CONFIGURED");
  assert.equal(body.error, "Sarvam is not configured. Add SARVAM_API_KEY and retry.");
  assert.equal(body.providerStatus, undefined);
});

test("providerErrorResponse handles SarvamRequestError with whitespace sanitization", async (t) => {
  t.mock.method(console, "error", () => {});

  const error = new SarvamRequestError(400, "Bad Request\n\n\n  Invalid    parameter.");
  const response = providerErrorResponse(error);

  assert.equal(response.status, 502);

  const body = await response.json();
  assert.equal(body.code, "PROVIDER_REQUEST_FAILED");
  assert.equal(
    body.error,
    "Sarvam rejected this request (400). Bad Request Invalid parameter."
  );
  assert.equal(body.providerStatus, 400);
});

test("providerErrorResponse handles SarvamRequestError with long detail truncation", async (t) => {
  t.mock.method(console, "error", () => {});

  const longDetail = "A".repeat(300);
  const error = new SarvamRequestError(429, longDetail);
  const response = providerErrorResponse(error);

  assert.equal(response.status, 502);

  const body = await response.json();
  assert.equal(body.code, "PROVIDER_REQUEST_FAILED");
  assert.equal(body.error.length > 240, true);
  assert.equal(body.error.includes("A".repeat(240)), true);
  assert.equal(body.error.includes("A".repeat(241)), false);
  assert.equal(body.providerStatus, 429);
});

test("providerErrorResponse handles generic Error", async (t) => {
  t.mock.method(console, "error", () => {});

  const error = new Error("Something went completely wrong");
  const response = providerErrorResponse(error);

  assert.equal(response.status, 502);

  const body = await response.json();
  assert.equal(body.code, "PROVIDER_REQUEST_FAILED");
  assert.equal(body.error, "Sarvam could not complete this request. Retry or use the disclosed fallback case.");
  assert.equal(body.providerStatus, undefined);
});

test("providerErrorResponse handles non-error string throwables", async (t) => {
  t.mock.method(console, "error", () => {});

  const error = "Just a string error";
  const response = providerErrorResponse(error);

  assert.equal(response.status, 502);

  const body = await response.json();
  assert.equal(body.code, "PROVIDER_REQUEST_FAILED");
  assert.equal(body.error, "Sarvam could not complete this request. Retry or use the disclosed fallback case.");
  assert.equal(body.providerStatus, undefined);
});
