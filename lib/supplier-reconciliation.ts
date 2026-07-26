import {
  supplierOfferSchema,
  type SupplierOffer,
} from "./domain";

function wasPreviouslyResolved(
  existing: SupplierOffer | undefined,
  pattern: RegExp,
): boolean {
  return Boolean(
    existing &&
      !existing.unresolvedQuestions.some((question) => pattern.test(question)),
  );
}

function spokenNumbers(transcript: string): number[] {
  return Array.from(
    transcript.matchAll(/(?:₹|rs\.?|inr)?\s*(\d[\d,\s]*\d|\d)/gi),
  )
    .map((match) => Number(match[1].replaceAll(/[,\s]/g, "")))
    .filter((value) => Number.isFinite(value));
}

function hasExplicitCorrection(transcript: string): boolean {
  return (
    /\b(correction|correct that|nahi|nahin|no[,— -]|rather|sorry|instead)\b/i.test(
      transcript,
    ) && spokenNumbers(transcript).length >= 2
  );
}

export function reconcileSupplierOffer(
  raw: unknown,
  transcript: string,
  existing?: SupplierOffer,
): SupplierOffer {
  const parsed = supplierOfferSchema.parse(raw);
  const normalized = transcript.toLowerCase();

  const mentionsPayment =
    /\b(payment|pay|paid|advance|credit|net[\s-]?\d+|cash on delivery|cod)\b/i.test(
      normalized,
    );
  const mentionsFreight = /\b(freight|transport|shipping|delivery charge)\b/i.test(
    normalized,
  );
  const mentionsUnloading = /\b(unload|unloading|hamali|labou?r)\b/i.test(
    normalized,
  );
  const mentionsTax = /\b(gst|tax|taxes)\b/i.test(normalized);
  const mentionsUnitPrice =
    /\b(per|each|unit price|rate)\b.{0,20}\b(bag|piece|unit|kg|tonne?|liter)\b/i.test(
      normalized,
    ) ||
    /\b(bag|piece|unit|kg|tonne?|liter)\b.{0,20}\b(per|each)\b/i.test(
      normalized,
    );
  const statedNumbers = new Set(spokenNumbers(transcript));

  const paymentKnown =
    mentionsPayment ||
    (existing?.paymentTerm !== "unknown" &&
      wasPreviouslyResolved(existing, /payment|credit|advance/i));
  const freightKnown =
    mentionsFreight && /\b(included?|excluded?|extra|separate)\b/i.test(normalized)
      ? true
      : wasPreviouslyResolved(existing, /freight|transport/i);
  const unloadingKnown =
    mentionsUnloading && /\b(included?|excluded?|extra|separate)\b/i.test(normalized)
      ? true
      : wasPreviouslyResolved(existing, /unload|hamali|labou?r/i);
  const taxKnown =
    mentionsTax && /\b(included?|excluded?|extra|separate)\b/i.test(normalized)
      ? true
      : wasPreviouslyResolved(existing, /gst|tax/i);

  const unresolved = new Set(parsed.unresolvedQuestions);
  const setQuestion = (pattern: RegExp, known: boolean, question: string) => {
    for (const existingQuestion of unresolved) {
      if (pattern.test(existingQuestion)) unresolved.delete(existingQuestion);
    }
    if (!known) unresolved.add(question);
  };
  setQuestion(/price|total|amount|rate/i, parsed.totalPrice > 0, "What is the final total price?");
  setQuestion(
    /deliver|date|deadline/i,
    parsed.deliveryDate !== "unknown",
    "What delivery date can you commit to?",
  );
  setQuestion(/payment|credit|advance/i, paymentKnown, "What payment term are you offering?");
  setQuestion(/freight|transport/i, freightKnown, "Is freight included?");
  setQuestion(/unload|hamali|labou?r/i, unloadingKnown, "Is unloading included?");
  setQuestion(/gst|tax/i, taxKnown, "Is GST included?");

  const corrections = [
    ...(existing?.corrections || []),
    ...(hasExplicitCorrection(transcript)
      ? parsed.corrections.filter(
          (correction) =>
            statedNumbers.has(correction.before) &&
            statedNumbers.has(correction.after),
        )
      : []),
  ].filter(
    (correction, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.before === correction.before &&
          candidate.after === correction.after,
      ) === index,
  );

  const offer = supplierOfferSchema.parse({
    ...parsed,
    unitPrice: mentionsUnitPrice
      ? parsed.unitPrice
      : existing?.unitPrice || null,
    paymentTerm: paymentKnown
      ? parsed.paymentTerm === "unknown"
        ? existing?.paymentTerm || "unknown"
        : parsed.paymentTerm
      : "unknown",
    freightIncluded: mentionsFreight
      ? parsed.freightIncluded
      : existing?.freightIncluded || false,
    unloadingIncluded: mentionsUnloading
      ? parsed.unloadingIncluded
      : existing?.unloadingIncluded || false,
    gstIncluded: mentionsTax
      ? parsed.gstIncluded
      : existing?.gstIncluded || false,
    commitments: Array.from(
      new Set([...(existing?.commitments || []), ...parsed.commitments]),
    ),
    corrections,
    unresolvedQuestions: Array.from(unresolved),
    needsConfirmation: unresolved.size > 0,
  });
  return offer;
}
