import { z } from "zod";
import {
  buyerRequirementSchema,
  languageSchema,
  supplierOfferSchema,
} from "@/lib/domain";
import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";

export const runtime = "edge";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("buyer"),
    transcript: z.string().min(2).max(4000),
    language: languageSchema.default("te-IN"),
  }),
  z.object({
    kind: z.literal("supplier"),
    transcript: z.string().min(2).max(4000),
    language: languageSchema.default("hi-IN"),
    supplierName: z.string().min(1).max(120),
    buyerRequirement: buyerRequirementSchema,
  }),
]);

const paymentTerms = ["advance", "delivery", "net-7", "net-15", "net-30"] as const;
const buyerFieldNames = [
  "product",
  "specification",
  "quantity",
  "unit",
  "deliveryLocation",
  "requiredBy",
  "maximumBudget",
  "preferredPaymentTerm",
] as const;

function dateFromSpokenMonth(transcript: string): string | null {
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

function dateIsPlausible(value: string): boolean {
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

function paymentTermFromTranscript(
  transcript: string,
): (typeof paymentTerms)[number] | null {
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
  return netTerm ? (`net-${netTerm[1]}` as (typeof paymentTerms)[number]) : null;
}

function reconcileBuyerRequirement(
  raw: unknown,
  transcript: string,
) {
  const requirement = buyerRequirementSchema.parse(raw);
  if (!dateIsPlausible(requirement.requiredBy)) {
    requirement.requiredBy = dateFromSpokenMonth(transcript) || "unknown";
  }
  if (requirement.preferredPaymentTerm === "unknown") {
    requirement.preferredPaymentTerm =
      paymentTermFromTranscript(transcript) || "unknown";
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

const buyerJsonSchema = {
  name: "buyer_requirement",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "product",
      "specification",
      "quantity",
      "unit",
      "deliveryLocation",
      "requiredBy",
      "maximumBudget",
      "preferredPaymentTerm",
      "constraints",
      "normalizedSummary",
      "missingFields",
      "needsConfirmation",
    ],
    properties: {
      product: { type: "string" },
      specification: { type: "string" },
      quantity: { type: "number", minimum: 0 },
      unit: { type: "string" },
      deliveryLocation: { type: "string" },
      requiredBy: {
        type: "string",
        pattern: "^(?:\\d{4}-\\d{2}-\\d{2}|unknown)$",
        description: "ISO date, YYYY-MM-DD. Convert relative or spoken dates using 2026-07-26 as today. Use unknown when absent.",
      },
      maximumBudget: { type: "number", minimum: 0 },
      preferredPaymentTerm: {
        type: "string",
        enum: [...paymentTerms, "unknown"],
      },
      constraints: { type: "array", items: { type: "string" } },
      normalizedSummary: { type: "string" },
      missingFields: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "product",
            "specification",
            "quantity",
            "unit",
            "deliveryLocation",
            "requiredBy",
            "maximumBudget",
            "preferredPaymentTerm",
          ],
        },
      },
      needsConfirmation: { type: "boolean" },
    },
  },
};

const supplierJsonSchema = {
  name: "supplier_offer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "supplierName",
      "totalPrice",
      "unitPrice",
      "deliveryDate",
      "paymentTerm",
      "freightIncluded",
      "unloadingIncluded",
      "gstIncluded",
      "commitments",
      "corrections",
      "unresolvedQuestions",
      "normalizedSummary",
      "needsConfirmation",
    ],
    properties: {
      supplierName: { type: "string" },
      totalPrice: { type: "number" },
      unitPrice: { type: ["number", "null"] },
      deliveryDate: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "ISO date, YYYY-MM-DD. Convert spoken dates using 2026-07-26 as today.",
      },
      paymentTerm: { type: "string", enum: paymentTerms },
      freightIncluded: { type: "boolean" },
      unloadingIncluded: { type: "boolean" },
      gstIncluded: { type: "boolean" },
      commitments: { type: "array", items: { type: "string" } },
      corrections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["before", "after", "evidence"],
          properties: {
            before: { type: "number" },
            after: { type: "number" },
            evidence: { type: "string" },
          },
        },
      },
      unresolvedQuestions: { type: "array", items: { type: "string" } },
      normalizedSummary: { type: "string" },
      needsConfirmation: { type: "boolean" },
    },
  },
};

async function structuredCompletion(
  schema: typeof buyerJsonSchema | typeof supplierJsonSchema,
  system: string,
  user: string,
) {
  let parseError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await sarvamFetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.SARVAM_CHAT_MODEL || "sarvam-30b",
        reasoning_effort: null,
        temperature: 0.05,
        max_tokens: attempt === 0 ? 1600 : 2200,
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
          {
            role: "system",
            content:
              system +
              (attempt === 0
                ? ""
                : " Return exactly one compact JSON object with no markdown, commentary, or trailing text."),
          },
          { role: "user", content: user },
        ],
      }),
    });
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      parseError = new Error("Sarvam returned no structured content.");
      continue;
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      parseError = error;
      console.warn(
        `Sarvam returned malformed structured content on attempt ${attempt + 1}; retrying.`,
      );
    }
  }

  throw parseError instanceof Error
    ? parseError
    : new Error("Sarvam returned invalid structured content.");
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid understanding request." }, { status: 400 });
  }

  try {
    if (parsed.data.kind === "buyer") {
      const data = await structuredCompletion(
        buyerJsonSchema,
        [
          "You extract procurement requirements from Indian multilingual and code-mixed speech.",
          "Today is 2026-07-26 in Bengaluru.",
          "Preserve exact quantities, money, places, and deadlines.",
          "Separate the generic item from its specification: for '53 grade cement', product is 'cement' and specification is '53 grade'; for 'TMT Fe 550 steel', product is 'TMT steel' and specification is 'Fe 550'.",
          "missingFields may contain only these buyer-commercial fields: product, specification, quantity, unit, deliveryLocation, requiredBy, maximumBudget, preferredPaymentTerm.",
          "Do not request supplier name, supplier contact, full street address, payment method, or any field outside that list.",
          "An area or site name is a sufficient deliveryLocation. A stated payment timing such as payment on delivery is a sufficient preferredPaymentTerm.",
          "Never invent missing facts. For an absent numeric field use 0; for an absent date or payment term use 'unknown'; for another absent string field use 'unknown'. List every absent or ambiguous allowed field in missingFields and set needsConfirmation true.",
          "If missingFields is empty, needsConfirmation must be false.",
          "Convert spoken dates to ISO dates. normalizedSummary must be concise English.",
        ].join(" "),
        parsed.data.transcript,
      );
      return Response.json({
        requirement: reconcileBuyerRequirement(data, parsed.data.transcript),
      });
    }

    const data = await structuredCompletion(
      supplierJsonSchema,
      [
        "You extract a supplier's final offer and verbal commitments from Indian Hinglish or Hindi speech.",
        "Today is 2026-07-26 in Bengaluru.",
        "Self-corrections are critical: when the speaker says one value and corrects it, use only the final value and include the before, after, and exact short evidence phrase in corrections.",
        "Correction before and after must be numeric amounts such as 40800 and 40200, while evidence keeps the speaker's exact wording.",
        "Do not infer freight, unloading, GST, payment terms, or dates unless explicitly stated.",
        "Every explicitly stated price, freight, unloading, GST, delivery, and payment promise must appear as a separate item in commitments.",
        "Put absent or ambiguous commercial facts in unresolvedQuestions and set needsConfirmation true.",
        "normalizedSummary must summarize the supplier's final offer, not restate the buyer requirement.",
        "Never claim that an order is placed.",
      ].join(" "),
      JSON.stringify({
        supplierName: parsed.data.supplierName,
        buyerRequirement: parsed.data.buyerRequirement,
        transcript: parsed.data.transcript,
      }),
    );
    return Response.json({
      offer: supplierOfferSchema.parse({
        ...data,
        supplierName: parsed.data.supplierName,
      }),
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
