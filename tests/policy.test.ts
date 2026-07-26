import { test } from "node:test";
import assert from "node:assert/strict";
import { createPurchaseOrder } from "../lib/policy";
import type { BuyerRequirement, SupplierOffer, Decision } from "../lib/domain";

const baseRequirement: BuyerRequirement = {
  product: "cement",
  specification: "53 grade",
  quantity: 200,
  unit: "bags",
  deliveryLocation: "Whitefield site",
  requiredBy: "2026-07-29",
  maximumBudget: 41000,
  preferredPaymentTerm: "delivery",
  constraints: [],
  normalizedSummary: "Complete requirement",
  missingFields: [],
  needsConfirmation: false,
};

const baseOffer: SupplierOffer = {
  supplierName: "Metro Cement Depot",
  totalPrice: 40200,
  unitPrice: 201,
  deliveryDate: "2026-07-28",
  paymentTerm: "delivery",
  freightIncluded: true,
  unloadingIncluded: true,
  gstIncluded: true,
  commitments: [],
  corrections: [],
  unresolvedQuestions: [],
  normalizedSummary: "Complete offer",
  needsConfirmation: false,
};

test("createPurchaseOrder returns null when decision action is reject", () => {
  const decision: Decision = {
    action: "reject",
    reasons: ["Too expensive"],
    checks: [],
  };

  const result = createPurchaseOrder(baseRequirement, baseOffer, decision);
  assert.equal(result, null);
});

test("createPurchaseOrder returns null when deliveryDate is unknown", () => {
  const decision: Decision = {
    action: "auto-accept",
    reasons: [],
    checks: [],
  };

  const offerWithUnknownDelivery = { ...baseOffer, deliveryDate: "unknown" as const };

  const result = createPurchaseOrder(baseRequirement, offerWithUnknownDelivery, decision);
  assert.equal(result, null);
});

test("createPurchaseOrder returns null when paymentTerm is unknown", () => {
  const decision: Decision = {
    action: "auto-accept",
    reasons: [],
    checks: [],
  };

  const offerWithUnknownPayment = { ...baseOffer, paymentTerm: "unknown" as const };

  const result = createPurchaseOrder(baseRequirement, offerWithUnknownPayment, decision);
  assert.equal(result, null);
});

test("createPurchaseOrder creates a valid purchase order on auto-accept", () => {
  const decision: Decision = {
    action: "auto-accept",
    reasons: [],
    checks: [],
  };

  const result = createPurchaseOrder(baseRequirement, baseOffer, decision);

  assert.notEqual(result, null);
  if (result) {
    assert.match(result.id, /^KBL-\d{8}-\d{4}$/);
    assert.equal(result.supplierName, baseOffer.supplierName);
    assert.equal(result.product, baseRequirement.product);
    assert.equal(result.totalPrice, baseOffer.totalPrice);
    assert.equal(result.status, "draft-approved");
  }
});

test("createPurchaseOrder creates a valid purchase order on human-approval", () => {
  const decision: Decision = {
    action: "human-approval",
    reasons: ["Requires manual review"],
    checks: [],
  };

  const result = createPurchaseOrder(baseRequirement, baseOffer, decision);

  assert.notEqual(result, null);
  if (result) {
    assert.equal(result.status, "awaiting-human-approval");
  }
});
