import assert from "node:assert/strict";
import test from "node:test";
import type { BuyerRequirement, SupplierOffer } from "../lib/domain";
import { buildDealRoomView } from "../lib/deal-room";

const requirement: BuyerRequirement = {
  product: "cement",
  specification: "53 grade",
  quantity: 200,
  unit: "bags",
  deliveryLocation: "Whitefield site",
  requiredBy: "2026-07-29",
  maximumBudget: 41_000,
  preferredPaymentTerm: "delivery",
  constraints: ["Buyer-only negotiation ceiling"],
  normalizedSummary: "Complete requirement",
  missingFields: [],
  needsConfirmation: false,
};

const offer: SupplierOffer = {
  supplierName: "Sri Balaji Building Supplies",
  totalPrice: 40_200,
  unitPrice: 201,
  deliveryDate: "2026-07-28",
  paymentTerm: "delivery",
  freightIncluded: true,
  unloadingIncluded: true,
  gstIncluded: true,
  commitments: ["Freight, unloading and GST included"],
  corrections: [
    {
      before: 40_800,
      after: 40_200,
      evidence: "40,800—nahi, correction 40,200",
    },
  ],
  unresolvedQuestions: [],
  normalizedSummary: "Complete offer",
  needsConfirmation: false,
};

test("buyer room includes private commercial controls", () => {
  const room = buildDealRoomView("buyer", {
    requirement,
    offer,
    decision: null,
    evidence: null,
    supplierName: offer.supplierName,
  });
  assert.equal(room.perspective, "buyer");
  assert.equal(room.privateState.maximumBudget, 41_000);
  assert.match(JSON.stringify(room.timeline), /40,800.*40,200/);
});

test("supplier room excludes buyer budget, constraints and policy detail", () => {
  const room = buildDealRoomView("supplier", {
    requirement,
    offer,
    decision: null,
    evidence: null,
    supplierName: offer.supplierName,
  });
  const serialized = JSON.stringify(room);
  assert.equal(room.perspective, "supplier");
  assert.equal(room.supplierState.supplierName, offer.supplierName);
  assert.doesNotMatch(serialized, /41000/);
  assert.doesNotMatch(serialized, /Buyer-only negotiation ceiling/);
  assert.doesNotMatch(serialized, /privateState/);
});
