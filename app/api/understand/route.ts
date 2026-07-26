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

const paymentTerms = ["advance", "delivery", "net-7", "net-15", "net-30"];

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
  const response = await sarvamFetch("/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.SARVAM_CHAT_MODEL || "sarvam-30b",
      reasoning_effort: null,
      temperature: 0.05,
      max_tokens: 1000,
      response_format: { type: "json_schema", json_schema: schema },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("Sarvam returned no structured content.");
  return JSON.parse(content);
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
      return Response.json({ requirement: buyerRequirementSchema.parse(data) });
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
