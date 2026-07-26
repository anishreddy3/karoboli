import test from "node:test";
import assert from "node:assert/strict";
import { sarvamConfigured } from "../lib/sarvam-server";

test("sarvamConfigured returns true when SARVAM_API_KEY is set", () => {
  const originalKey = process.env.SARVAM_API_KEY;
  try {
    process.env.SARVAM_API_KEY = "test_key";
    assert.equal(sarvamConfigured(), true);
  } finally {
    if (originalKey === undefined) {
      delete process.env.SARVAM_API_KEY;
    } else {
      process.env.SARVAM_API_KEY = originalKey;
    }
  }
});

test("sarvamConfigured returns false when SARVAM_API_KEY is not set", () => {
  const originalKey = process.env.SARVAM_API_KEY;
  try {
    delete process.env.SARVAM_API_KEY;
    assert.equal(sarvamConfigured(), false);
  } finally {
    if (originalKey === undefined) {
      delete process.env.SARVAM_API_KEY;
    } else {
      process.env.SARVAM_API_KEY = originalKey;
    }
  }
});

test("sarvamConfigured returns false when SARVAM_API_KEY is an empty string", () => {
  const originalKey = process.env.SARVAM_API_KEY;
  try {
    process.env.SARVAM_API_KEY = "";
    assert.equal(sarvamConfigured(), false);
  } finally {
    if (originalKey === undefined) {
      delete process.env.SARVAM_API_KEY;
    } else {
      process.env.SARVAM_API_KEY = originalKey;
    }
  }
});
