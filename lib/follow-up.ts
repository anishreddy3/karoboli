import type { BuyerRequirement, SupplierOffer } from "./domain";

const buyerQuestions: Record<string, string> = {
  product: "What product do you need?",
  specification: "What grade, brand, or specification do you require?",
  quantity: "What quantity do you need?",
  unit: "Which unit should I use for that quantity?",
  deliveryLocation: "Where should the material be delivered?",
  requiredBy: "What is the required delivery date?",
  maximumBudget: "What is the maximum total budget?",
  preferredPaymentTerm: "What payment timing do you prefer?",
};

const supplierQuestionMatchers: Array<[RegExp, string]> = [
  [/price|total|amount|rate/i, "What is your final landed total price?"],
  [/deliver|date|deadline/i, "What delivery date can you commit to?"],
  [/freight|transport/i, "Is freight included in that total?"],
  [/gst|tax/i, "Is GST included in that total?"],
  [/unload/i, "Is unloading included in that total?"],
  [/payment|credit|advance/i, "What payment term are you offering?"],
];

export function nextBuyerQuestion(
  requirement: BuyerRequirement | null,
): string | null {
  if (!requirement?.needsConfirmation) return null;
  const field = requirement.missingFields[0];
  return buyerQuestions[field] || "Could you clarify the missing commercial detail?";
}

export function nextSupplierQuestion(
  offer: SupplierOffer | null,
): string | null {
  if (!offer?.needsConfirmation) return null;
  const unresolved = offer.unresolvedQuestions.join(" ");
  for (const [pattern, question] of supplierQuestionMatchers) {
    if (pattern.test(unresolved)) return question;
  }
  if (offer.totalPrice <= 0) return "What is your final landed total price?";
  if (offer.deliveryDate === "unknown") {
    return "What delivery date can you commit to?";
  }
  if (offer.paymentTerm === "unknown") {
    return "What payment term are you offering?";
  }
  return "Which commercial detail should I record before evaluating the offer?";
}
