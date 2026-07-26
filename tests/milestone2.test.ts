import assert from "node:assert/strict";
import test from "node:test";
import type { BuyerRequirement, SupplierOffer } from "../lib/domain";
import { nextBuyerQuestion, nextSupplierQuestion } from "../lib/follow-up";
import { evaluateOffer, buildGuardrails } from "../lib/policy";
import { reconcileBuyerRequirement } from "../lib/requirement-reconciliation";
import { reconcileSupplierOffer } from "../lib/supplier-reconciliation";

const baseRequirement: BuyerRequirement = {
  product: "cement",
  specification: "53 grade",
  quantity: 200,
  unit: "bags",
  deliveryLocation: "Whitefield site",
  requiredBy: "2026-07-29",
  maximumBudget: 41_000,
  preferredPaymentTerm: "delivery",
  constraints: [],
  normalizedSummary: "Complete requirement",
  missingFields: [],
  needsConfirmation: false,
};

test("Telugu repeat case preserves confirmed facts across one follow-up", () => {
  const firstTurn = reconcileBuyerRequirement(
    {
      ...baseRequirement,
      maximumBudget: 0,
      preferredPaymentTerm: "unknown",
      missingFields: ["maximumBudget", "preferredPaymentTerm"],
      needsConfirmation: true,
    },
    "I need 200 bags of 53 grade cement at Whitefield by July 29.",
  );
  assert.equal(nextBuyerQuestion(firstTurn), "What is the maximum total budget?");

  const completed = reconcileBuyerRequirement(
    {
      ...firstTurn,
      product: "unknown",
      specification: "unknown",
      quantity: 0,
      unit: "unknown",
      deliveryLocation: "unknown",
      requiredBy: "unknown",
      maximumBudget: 41_000,
      preferredPaymentTerm: "delivery",
      missingFields: [],
      needsConfirmation: false,
    },
    "Maximum budget is 41,000 rupees, payment on delivery.",
    firstTurn,
  );
  assert.equal(completed.product, "cement");
  assert.equal(completed.requiredBy, "2026-07-29");
  assert.equal(completed.maximumBudget, 41_000);
  assert.deepEqual(completed.missingFields, []);
  assert.equal(completed.needsConfirmation, false);
});

test("Tamil repeat case repairs spoken dates and recomputes readiness", () => {
  const requirement = reconcileBuyerRequirement(
    {
      ...baseRequirement,
      requiredBy: "2907-07-26",
      missingFields: Object.keys(baseRequirement),
      needsConfirmation: true,
    },
    "Deliver by 29 July. Maximum budget 41,000 rupees. Payment on delivery.",
  );
  assert.equal(requirement.requiredBy, "2026-07-29");
  assert.deepEqual(requirement.missingFields, []);
  assert.equal(requirement.needsConfirmation, false);
});

test("English repeat case asks only the first missing commercial question", () => {
  const requirement: BuyerRequirement = {
    ...baseRequirement,
    deliveryLocation: "unknown",
    requiredBy: "unknown",
    missingFields: ["deliveryLocation", "requiredBy"],
    needsConfirmation: true,
  };
  assert.equal(
    nextBuyerQuestion(requirement),
    "Where should the material be delivered?",
  );
});

test("supplier uncertainty gets one targeted question before policy", () => {
  const rawOffer: SupplierOffer = {
    supplierName: "Metro Cement Depot",
    totalPrice: 40_200,
    unitPrice: 201,
    deliveryDate: "2026-07-28",
    paymentTerm: "delivery",
    freightIncluded: false,
    unloadingIncluded: true,
    gstIncluded: true,
    commitments: ["Delivery by 28 July"],
    corrections: [],
    unresolvedQuestions: [],
    normalizedSummary: "Freight remains unresolved.",
    needsConfirmation: false,
  };
  const offer = reconcileSupplierOffer(
    rawOffer,
    "Final total is 40,200 rupees and delivery is July 28.",
  );
  assert.equal(offer.unitPrice, null);
  assert.equal(offer.paymentTerm, "unknown");
  assert.deepEqual(offer.corrections, []);
  assert.ok(offer.unresolvedQuestions.includes("Is freight included?"));
  assert.equal(
    nextSupplierQuestion(offer),
    "Is freight included in that total?",
  );
  assert.equal(
    evaluateOffer(offer, buildGuardrails(baseRequirement)).action,
    "human-approval",
  );
});

test("three unseen language cases retain a verified Hinglish correction", () => {
  for (const language of ["Telugu", "Tamil", "English"]) {
    const offer = reconcileSupplierOffer(
      {
        supplierName: `${language} repeat supplier`,
        totalPrice: 40_000,
        unitPrice: 200,
        deliveryDate: "2026-07-28",
        paymentTerm: "delivery",
        freightIncluded: true,
        unloadingIncluded: true,
        gstIncluded: true,
        commitments: [
          "Freight, unloading and GST included",
          "Delivery July 28",
          "Payment on delivery",
        ],
        corrections: [
          {
            before: 40_800,
            after: 40_000,
            evidence: "40,800—nahi, correction 40,000",
          },
        ],
        unresolvedQuestions: [],
        normalizedSummary: `${language} buyer repeat offer`,
        needsConfirmation: false,
      },
      "Total 40,800—nahi, correction 40,000. Rate 200 per bag. Freight, unloading and GST included. Delivery July 28. Payment on delivery.",
    );
    assert.equal(offer.corrections.length, 1);
    assert.equal(offer.needsConfirmation, false);
    assert.equal(
      evaluateOffer(offer, buildGuardrails(baseRequirement)).action,
      "auto-accept",
    );
  }
});

test("verified supplier correction deterministically becomes the final total", () => {
  const offer = reconcileSupplierOffer(
    {
      supplierName: "Correction test supplier",
      totalPrice: 40_800,
      unitPrice: null,
      deliveryDate: "2026-07-28",
      paymentTerm: "delivery",
      freightIncluded: true,
      unloadingIncluded: true,
      gstIncluded: true,
      commitments: ["Final corrected total is ₹40,200"],
      corrections: [
        {
          before: 40_800,
          after: 40_200,
          evidence: "40800, nahi correction 40200",
        },
      ],
      unresolvedQuestions: [],
      normalizedSummary: "Corrected supplier offer",
      needsConfirmation: false,
    },
    "Total 40800, nahi correction 40200. Freight, unloading and GST included. Delivery July 28, payment on delivery.",
  );

  assert.equal(offer.totalPrice, 40_200);
});
