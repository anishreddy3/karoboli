import type {
  BuyerRequirement,
  Decision,
  Guardrails,
  PaymentTerm,
  PurchaseOrder,
  SupplierOffer,
} from "./domain";

function dateAtMidnight(value: string): number {
  return new Date(`${value}T00:00:00Z`).getTime();
}

export function buildGuardrails(requirement: BuyerRequirement): Guardrails {
  if (
    requirement.maximumBudget <= 0 ||
    requirement.requiredBy === "unknown" ||
    requirement.preferredPaymentTerm === "unknown"
  ) {
    throw new Error("Cannot build guardrails from an incomplete buyer requirement.");
  }

  return {
    targetTotal: Math.round(requirement.maximumBudget * 0.94),
    autonomousCeiling: Math.round(requirement.maximumBudget * 0.98),
    absoluteBudget: requirement.maximumBudget,
    requiredBy: requirement.requiredBy,
    allowedPaymentTerms: ([
      requirement.preferredPaymentTerm,
      "delivery",
      "net-7",
      "net-15",
    ] satisfies PaymentTerm[]).filter(
      (value, index, array) => array.indexOf(value) === index,
    ),
    requireFreightIncluded: true,
  };
}

export function evaluateOffer(
  offer: SupplierOffer,
  guardrails: Guardrails,
): Decision {
  const priceKnown = offer.totalPrice > 0;
  const deliveryKnown = offer.deliveryDate !== "unknown";
  const paymentKnown = offer.paymentTerm !== "unknown";
  const budgetOkay = priceKnown && offer.totalPrice <= guardrails.absoluteBudget;
  const autonomousOkay =
    priceKnown && offer.totalPrice <= guardrails.autonomousCeiling;
  const deliveryOkay =
    deliveryKnown &&
    dateAtMidnight(offer.deliveryDate) <= dateAtMidnight(guardrails.requiredBy);
  const paymentOkay =
    offer.paymentTerm !== "unknown" &&
    guardrails.allowedPaymentTerms.includes(offer.paymentTerm);
  const freightOkay = !guardrails.requireFreightIncluded || offer.freightIncluded;
  const complete =
    priceKnown &&
    deliveryKnown &&
    paymentKnown &&
    offer.unresolvedQuestions.length === 0 &&
    !offer.needsConfirmation;

  const checks = [
    {
      label: "Absolute budget",
      passed: budgetOkay,
      detail: `₹${offer.totalPrice.toLocaleString("en-IN")} ≤ ₹${guardrails.absoluteBudget.toLocaleString("en-IN")}`,
    },
    {
      label: "Autonomy ceiling",
      passed: autonomousOkay,
      detail: `₹${offer.totalPrice.toLocaleString("en-IN")} ≤ ₹${guardrails.autonomousCeiling.toLocaleString("en-IN")}`,
    },
    {
      label: "Delivery deadline",
      passed: deliveryOkay,
      detail: `${offer.deliveryDate} ≤ ${guardrails.requiredBy}`,
    },
    {
      label: "Payment term",
      passed: paymentOkay,
      detail: `${offer.paymentTerm} is ${paymentOkay ? "allowed" : "not allowed"}`,
    },
    {
      label: "Freight included",
      passed: freightOkay,
      detail: offer.freightIncluded ? "Supplier committed" : "Not confirmed",
    },
    {
      label: "No unresolved facts",
      passed: complete,
      detail: complete
        ? "Offer is complete"
        : offer.unresolvedQuestions.join(", ") || "Confirmation required",
    },
  ];

  if (!complete) {
    return {
      action: "human-approval",
      reasons: ["Offer has unresolved commercial facts"],
      checks,
    };
  }

  if (!budgetOkay || !deliveryOkay || !paymentOkay || !freightOkay) {
    return {
      action: "reject",
      reasons: checks.filter((check) => !check.passed).map((check) => check.label),
      checks,
    };
  }

  if (!autonomousOkay || !complete) {
    return {
      action: "human-approval",
      reasons: checks.filter((check) => !check.passed).map((check) => check.label),
      checks,
    };
  }

  return {
    action: "auto-accept",
    reasons: [
      `Offer is ₹${(guardrails.autonomousCeiling - offer.totalPrice).toLocaleString("en-IN")} below the autonomy ceiling`,
      "Delivery and commercial commitments satisfy policy",
    ],
    checks,
  };
}

export function createPurchaseOrder(
  requirement: BuyerRequirement,
  offer: SupplierOffer,
  decision: Decision,
): PurchaseOrder | null {
  if (
    decision.action === "reject" ||
    offer.deliveryDate === "unknown" ||
    offer.paymentTerm === "unknown"
  ) {
    return null;
  }

  return {
    id: `KBL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`,
    createdAt: new Date().toISOString(),
    supplierName: offer.supplierName,
    product: requirement.product,
    specification: requirement.specification,
    quantity: requirement.quantity,
    unit: requirement.unit,
    deliveryLocation: requirement.deliveryLocation,
    deliveryDate: offer.deliveryDate,
    paymentTerm: offer.paymentTerm,
    totalPrice: offer.totalPrice,
    freightIncluded: offer.freightIncluded,
    unloadingIncluded: offer.unloadingIncluded,
    gstIncluded: offer.gstIncluded,
    commitments: offer.commitments,
    status:
      decision.action === "auto-accept"
        ? "draft-approved"
        : "awaiting-human-approval",
  };
}
