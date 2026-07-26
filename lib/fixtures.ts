import type { BuyerRequirement, SupplierOffer } from "./domain";

export const fallbackBuyerTranscript =
  "Naaku 200 bags 53 grade cement kavali, Whitefield site ki July 29 lopu delivery. Maximum budget forty one thousand rupees, payment delivery appudu.";

export const fallbackSupplierTranscript =
  "Sir total forty thousand eight hundred—nahi, correction forty thousand two hundred. Freight aur unloading included hai. GST bhi included. July twenty eighth delivery, payment on delivery.";

export const fallbackRequirement: BuyerRequirement = {
  product: "OPC cement",
  specification: "53 grade",
  quantity: 200,
  unit: "bags",
  deliveryLocation: "Whitefield, Bengaluru",
  requiredBy: "2026-07-29",
  maximumBudget: 41_000,
  preferredPaymentTerm: "delivery",
  constraints: ["Delivery no later than 2026-07-29"],
  normalizedSummary:
    "200 bags of 53 grade OPC cement delivered to Whitefield by 29 July, within ₹41,000, payable on delivery.",
  missingFields: [],
  needsConfirmation: false,
};

export const fallbackOffer: SupplierOffer = {
  supplierName: "Sri Balaji Building Supplies",
  totalPrice: 40_200,
  unitPrice: 201,
  deliveryDate: "2026-07-28",
  paymentTerm: "delivery",
  freightIncluded: true,
  unloadingIncluded: true,
  gstIncluded: true,
  commitments: [
    "Final total is ₹40,200",
    "Freight and unloading are included",
    "GST is included",
    "Delivery on 2026-07-28",
    "Payment on delivery",
  ],
  corrections: [
    {
      before: 40_800,
      after: 40_200,
      evidence: "forty thousand eight hundred—nahi, correction forty thousand two hundred",
    },
  ],
  unresolvedQuestions: [],
  normalizedSummary:
    "Supplier corrected the total from ₹40,800 to ₹40,200, all-inclusive, for delivery on 28 July and payment on delivery.",
  needsConfirmation: false,
};
