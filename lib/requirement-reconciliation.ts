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

function knownString(next: string, previous?: string): string {
  return next.toLowerCase() === "unknown" && previous ? previous : next;
}

function knownNumber(next: number, previous?: number): number {
  return next <= 0 && previous && previous > 0 ? previous : next;
}

const monthAliases: Array<[number, string[]]> = [
  [1, ["january", "jan", "జనవరి", "ஜனவரி", "जनवरी"]],
  [2, ["february", "feb", "ఫిబ్రవరి", "பிப்ரவரி", "फरवरी"]],
  [3, ["march", "mar", "మార్చి", "மார்ச்", "मार्च"]],
  [4, ["april", "apr", "ఏప్రిల్", "ஏப்ரல்", "अप्रैल"]],
  [5, ["may", "మే", "மே", "मई"]],
  [6, ["june", "jun", "జూన్", "ஜூன்", "जून"]],
  [7, ["july", "jul", "జూలై", "జులై", "ஜூலை", "जुलाई"]],
  [8, ["august", "aug", "ఆగస్టు", "ஆகஸ்ட்", "अगस्त"]],
  [9, ["september", "sep", "సెప్టెంబర్", "செப்டம்பர்", "सितंबर"]],
  [10, ["october", "oct", "అక్టోబర్", "அக்டோபர்", "अक्टूबर"]],
  [11, ["november", "nov", "నవంబర్", "நவம்பர்", "नवंबर"]],
  [12, ["december", "dec", "డిసెంబర్", "டிசம்பர்", "दिसंबर"]],
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
    /day after tomorrow|ఎల్లుండి|நாளை மறுநாள்|परसों/.test(normalized)
  ) {
    return addReferenceDays(2);
  }
  if (/\btomorrow\b|రేపు|நாளை|कल/.test(normalized)) {
    return addReferenceDays(1);
  }
  if (/\btoday\b|ఈరోజు|నేడు|இன்று|आज/.test(normalized)) {
    return addReferenceDays(0);
  }

  const withinDays = normalized.match(
    /(?:within|in)\s+(\d{1,2})\s+days?|(\d{1,2})\s*(?:రోజుల్లో|நாட்களில்|दिनों में)/,
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
    let year = Number(numeric[3] || referenceToday.getUTCFullYear());
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
        explicitYear?.[1] || referenceToday.getUTCFullYear(),
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

const EARLIEST_PLAUSIBLE_TIME = referenceToday.getTime();
const LATEST_PLAUSIBLE_TIME = new Date("2027-07-26T00:00:00Z").getTime();

export function dateIsPlausible(value: string): boolean {
  if (value === "unknown") return false;
  const date = new Date(`${value}T00:00:00Z`);
  const t = date.getTime();
  return (
    !Number.isNaN(t) &&
    t >= EARLIEST_PLAUSIBLE_TIME &&
    t <= LATEST_PLAUSIBLE_TIME
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
