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

const referenceToday = new Date("2026-07-26T00:00:00Z");
const referenceYear = referenceToday.getUTCFullYear();
const earliestTime = referenceToday.getTime();
const latestTime = new Date("2027-07-26T00:00:00Z").getTime();

function knownString(next: string, previous?: string): string {
  return next.toLowerCase() === "unknown" && previous ? previous : next;
}

function knownNumber(next: number, previous?: number): number {
  return next <= 0 && previous && previous > 0 ? previous : next;
}

const monthAliases: Array<[number, string[]]> = [
  [1, ["january", "jan", "\u0c1c\u0c28\u0c35\u0c30\u0c3f", "\u0b9c\u0ba9\u0bb5\u0bb0\u0bbf", "\u091c\u0928\u0935\u0930\u0940"]],
  [2, ["february", "feb", "\u0c2b\u0c3f\u0c2c\u0c4d\u0c30\u0c35\u0c30\u0c3f", "\u0baa\u0bbf\u0baa\u0bcd\u0bb0\u0bb5\u0bb0\u0bbf", "\u092b\u0930\u0935\u0930\u0940"]],
  [3, ["march", "mar", "\u0c2e\u0c3e\u0c30\u0c4d\u0c1a\u0c3f", "\u0bae\u0bbe\u0bb0\u0bcd\u0b9a\u0bcd", "\u092e\u093e\u0930\u094d\u091a"]],
  [4, ["april", "apr", "\u0c0f\u0c2a\u0c4d\u0c30\u0c3f\u0c32\u0c4d", "\u0b8f\u0baa\u0bcd\u0bb0\u0bb2\u0bcd", "\u0905\u092a\u094d\u0930\u0948\u0932"]],
  [5, ["may", "\u0c2e\u0c47", "\u0bae\u0bc7", "\u092e\u0908"]],
  [6, ["june", "jun", "\u0c1c\u0c42\u0c28\u0c4d", "\u0b9c\u0bc2\u0ba9\u0bcd", "\u091c\u0942\u0928"]],
  [7, ["july", "jul", "\u0c1c\u0c42\u0c32\u0c48", "\u0c1c\u0c41\u0c32\u0c48", "\u0b9c\u0bc2\u0bb2\u0bc8", "\u091c\u0941\u0932\u093e\u0908"]],
  [8, ["august", "aug", "\u0c06\u0c17\u0c38\u0c4d\u0c1f\u0c41", "\u0b86\u0b95\u0bb8\u0bcd\u0b9f\u0bcd", "\u0905\u0917\u0938\u094d\u0924"]],
  [9, ["september", "sep", "\u0c38\u0c46\u0c2a\u0c4d\u0c1f\u0c46\u0c02\u0c2c\u0c30\u0c4d", "\u0b9a\u0bc6\u0baa\u0bcd\u0b9f\u0bae\u0bcd\u0baa\u0bb0\u0bcd", "\u0938\u093f\u0924\u0902\u092c\u0930"]],
  [10, ["october", "oct", "\u0c05\u0c15\u0c4d\u0c1f\u0c4b\u0c2c\u0c30\u0c4d", "\u0b85\u0b95\u0bcd\u0b9f\u0bcb\u0baa\u0bb0\u0bcd", "\u0905\u0915\u094d\u091f\u0942\u092c\u0930"]],
  [11, ["november", "nov", "\u0c28\u0c35\u0c02\u0c2c\u0c30\u0c4d", "\u0ba8\u0bb5\u0bae\u0bcd\u0baa\u0bb0\u0bcd", "\u0928\u0935\u0902\u092c\u0930"]],
  [12, ["december", "dec", "\u0c21\u0c3f\u0c38\u0c46\u0c02\u0c2c\u0c30\u0c4d", "\u0b9f\u0bbf\u0b9a\u0bae\u0bcd\u0baa\u0bb0\u0bcd", "\u0926\u093f\u0938\u0902\u092c\u0930"]],
];

const englishDays: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  thirtieth: 30,
  "thirty first": 31,
  "thirty-first": 31,
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addReferenceDays(days: number) {
  const date = new Date(referenceToday);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function dayNearMonth(value: string): number | null {
  const digit = value.match(/\b([0-2]?\d|3[01])(?:st|nd|rd|th)?\b/i);
  if (digit) return Number(digit[1]);
  for (const [phrase, day] of Object.entries(englishDays).sort(
    ([left], [right]) => right.length - left.length,
  )) {
    if (value.includes(phrase)) return day;
  }
  return null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function dateFromSpokenMonth(transcript: string): string | null {
  const normalized = transcript.toLowerCase().replace(/\s+/g, " ");
  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const exact = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (exact) return isoDate(exact);
  }

  if (
    /day after tomorrow|\u0c0e\u0c32\u0c4d\u0c32\u0c41\u0c02\u0c21\u0c3f|\u0ba8\u0bbe\u0bb3\u0bc8 \u0bae\u0bb1\u0bc1\u0ba8\u0bbe\u0bb3\u0bcd|\u092a\u0930\u0938\u094b\u0902/.test(normalized)
  ) {
    return addReferenceDays(2);
  }
  if (/\btomorrow\b|\u0c30\u0c47\u0c2a\u0c41|\u0ba8\u0bbe\u0bb3\u0bc8|\u0915\u0932/.test(normalized)) {
    return addReferenceDays(1);
  }
  if (/\btoday\b|\u0c08\u0c30\u0c4b\u0c1c\u0c41|\u0c28\u0c47\u0c21\u0c41|\u0b87\u0ba9\u0bcd\u0bb1\u0bc1|\u0906\u091c/.test(normalized)) {
    return addReferenceDays(0);
  }

  const withinDays = normalized.match(
    /(?:within|in)\s+(\d{1,2})\s+days?|(\d{1,2})\s*(?:\u0c30\u0c4b\u0c1c\u0c41\u0c32\u0c4d\u0c32\u0c4b|\u0ba8\u0bbe\u0b9f\u0bcd\u0b95\u0bb3\u0bbf\u0bb2\u0bcd|\u0926\u093f\u0928\u094b\u0902 \u092e\u0947\u0902)/,
  );
  if (withinDays) {
    const days = Number(withinDays[1] || withinDays[2]);
    if (days >= 0 && days <= 90) return addReferenceDays(days);
  }

  const numeric = normalized.match(
    /\b([0-3]?\d)[./-]([01]?\d)(?:[./-](20\d{2}))?\b/,
  );
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3] || referenceYear);
    let date = validDate(year, month, day);
    if (date && date < referenceToday && !numeric[3]) {
      year += 1;
      date = validDate(year, month, day);
    }
    if (date) return isoDate(date);
  }

  for (const [month, aliases] of monthAliases) {
    for (const alias of aliases) {
      const position = normalized.indexOf(alias);
      if (position < 0) continue;
      const nearby = normalized.slice(
        Math.max(0, position - 32),
        Math.min(normalized.length, position + alias.length + 32),
      );
      const day = dayNearMonth(nearby);
      if (!day) continue;
      const explicitYear = nearby.match(/\b(20\d{2})\b/);
      let year = Number(
        explicitYear?.[1] || referenceYear,
      );
      let date = validDate(year, month, day);
      if (date && date < referenceToday && !explicitYear) {
        year += 1;
        date = validDate(year, month, day);
      }
      if (date) return isoDate(date);
    }
  }

  return null;
}

export function dateIsPlausible(value: string): boolean {
  if (value === "unknown") return false;
  const time = new Date(`${value}T00:00:00Z`).getTime();
  return (
    !Number.isNaN(time) &&
    time >= earliestTime &&
    time <= latestTime
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
