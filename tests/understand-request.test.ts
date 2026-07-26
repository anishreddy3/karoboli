import assert from "node:assert/strict";
import test from "node:test";
import { understandingRequestSchema } from "../app/api/understand/route";
import { fallbackOffer, fallbackRequirement } from "../lib/fixtures";

test("first live buyer turn accepts an omitted or null previous requirement", () => {
  for (const existingRequirement of [undefined, null]) {
    const parsed = understandingRequestSchema.safeParse({
      kind: "buyer",
      transcript: "I need 200 bags of cement.",
      language: "en-IN",
      ...(existingRequirement === undefined ? {} : { existingRequirement }),
    });
    assert.equal(parsed.success, true);
  }
});

test("buyer follow-up accepts the previously structured requirement", () => {
  const parsed = understandingRequestSchema.safeParse({
    kind: "buyer",
    transcript: "Payment will be on delivery.",
    language: "en-IN",
    existingRequirement: fallbackRequirement,
  });
  assert.equal(parsed.success, true);
});

test("first supplier turn accepts a null previous offer", () => {
  const parsed = understandingRequestSchema.safeParse({
    kind: "supplier",
    transcript: "The final total is 40,200 rupees.",
    language: "hi-IN",
    supplierName: fallbackOffer.supplierName,
    buyerRequirement: fallbackRequirement,
    existingOffer: null,
  });
  assert.equal(parsed.success, true);
});
