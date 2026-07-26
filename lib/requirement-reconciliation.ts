import {
  buyerRequirementSchema,
  type BuyerRequirement,
} from "./domain";

type KnownPaymentTerm = Exclude<
  BuyerRequirement["preferredPaymentTerm"],
  "unknown"
>;

export const buyerFieldNames = [
  "product",
  "specification",
  "quantity",
  "unit",
  "deliveryLocation",
  "requiredBy",
  "maximumBudget",
  "preferredPaymentTerm",
] as const;

function knownString(next: string, previous?: string): string {
  return next.toLowerCase() === "unknown" && previous ? previous : next;
}

function knownNumber(next: number, previous?: number): number {
  return next <= 0 && previous && previous > 0 ? previous : next;
}

export function dateFromSpokenMonth(transcript: string): string | null {
  const monthNumbers: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const monthFirst = transcript.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
  );
  const dayFirst = transcript.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  );
  const monthName = monthFirst?.[1] || dayFirst?.[2];
  const dayText = monthFirst?.[2] || dayFirst?.[1];
  if (!monthName || !dayText) return null;

  const month = monthNumbers[monthName.toLowerCase()];
  const day = Number(dayText);
  if (!month || day < 1 || day > 31) return null;

  const today = new Date("2026-07-26T00:00:00Z");
  let year = today.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getTime() < today.getTime()) year += 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateIsPlausible(value: string): boolean {
  if (value === "unknown") return false;
  const date = new Date(`${value}T00:00:00Z`);
  const earliest = new Date("2026-07-26T00:00:00Z").getTime();
  const latest = new Date("2027-07-26T00:00:00Z").getTime();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() >= earliest &&
    date.getTime() <= latest
  );
}

export function paymentTermFromTranscript(
  transcript: string,
): KnownPaymentTerm | null {
  const normalized = transcript.toLowerCase();
  if (
    /\b(?:payment|pay|paid|cash)\b.{0,24}\b(?:on|upon|at)\s+delivery\b/.test(
      normalized,
    )
  ) {
    return "delivery";
  }
  if (/\badvance(?:\s+payment)?\b|\bpayment\s+in\s+advance\b/.test(normalized)) {
    return "advance";
  }
  const netTerm = normalized.match(/\bnet[\s-]?(7|15|30)\b/);
  return netTerm ? (`net-${netTerm[1]}` as KnownPaymentTerm) : null;
}

export function reconcileBuyerRequirement(
  raw: unknown,
  transcript: string,
  existing?: BuyerRequirement,
): BuyerRequirement {
  const parsed = buyerRequirementSchema.parse(raw);
  const requirement = buyerRequirementSchema.parse({
    ...parsed,
    product: knownString(parsed.product, existing?.product),
    specification: knownString(parsed.specification, existing?.specification),
    quantity: knownNumber(parsed.quantity, existing?.quantity),
    unit: knownString(parsed.unit, existing?.unit),
    deliveryLocation: knownString(
      parsed.deliveryLocation,
      existing?.deliveryLocation,
    ),
    maximumBudget: knownNumber(
      parsed.maximumBudget,
      existing?.maximumBudget,
    ),
    constraints: Array.from(
      new Set([...(existing?.constraints || []), ...parsed.constraints]),
    ),
  });

  if (!dateIsPlausible(requirement.requiredBy)) {
    requirement.requiredBy =
      dateFromSpokenMonth(transcript) ||
      (existing && dateIsPlausible(existing.requiredBy)
        ? existing.requiredBy
        : "unknown");
  }
  if (requirement.preferredPaymentTerm === "unknown") {
    requirement.preferredPaymentTerm =
      paymentTermFromTranscript(transcript) ||
      existing?.preferredPaymentTerm ||
      "unknown";
  }

  const missing = new Set<(typeof buyerFieldNames)[number]>();
  if (requirement.product.toLowerCase() === "unknown") missing.add("product");
  if (requirement.specification.toLowerCase() === "unknown") {
    missing.add("specification");
  }
  if (requirement.quantity <= 0) missing.add("quantity");
  if (requirement.unit.toLowerCase() === "unknown") missing.add("unit");
  if (requirement.deliveryLocation.toLowerCase() === "unknown") {
    missing.add("deliveryLocation");
  }
  if (!dateIsPlausible(requirement.requiredBy)) missing.add("requiredBy");
  if (requirement.maximumBudget <= 0) missing.add("maximumBudget");
  if (requirement.preferredPaymentTerm === "unknown") {
    missing.add("preferredPaymentTerm");
  }

  requirement.missingFields = buyerFieldNames.filter((field) =>
    missing.has(field),
  );
  requirement.needsConfirmation = requirement.missingFields.length > 0;
  return requirement;
}
