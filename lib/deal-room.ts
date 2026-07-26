import type {
  BuyerRequirement,
  Decision,
  EvidenceRecord,
  SupplierOffer,
} from "./domain";

export type DealRoomPerspective = "buyer" | "supplier";

type DealRoomInput = {
  requirement: BuyerRequirement;
  offer: SupplierOffer | null;
  decision: Decision | null;
  evidence: EvidenceRecord | null;
  supplierName: string;
};

type SharedRoomState = {
  roomId: string;
  phase: "awaiting-offer" | "clarification" | "policy-review" | "closed";
  requirement: {
    product: string;
    specification: string;
    quantity: number;
    unit: string;
    deliveryLocation: string;
    requiredBy: string;
  };
  latestOffer: {
    totalPrice: number;
    deliveryDate: string;
    paymentTerm: string;
    commitments: string[];
  } | null;
  timeline: Array<{
    actor: "Buyer" | "Supplier" | "Karoboli";
    label: string;
    detail: string;
  }>;
};

export type BuyerDealRoomView = SharedRoomState & {
  perspective: "buyer";
  privateState: {
    maximumBudget: number;
    decisionAction: Decision["action"] | "pending";
    evidenceId: string | null;
  };
};

export type SupplierDealRoomView = SharedRoomState & {
  perspective: "supplier";
  supplierState: {
    supplierName: string;
    confirmationRequired: boolean;
    outcome:
      | "awaiting-offer"
      | "clarification-required"
      | "accepted"
      | "approval-pending"
      | "not-accepted";
  };
};

export type DealRoomView = BuyerDealRoomView | SupplierDealRoomView;

function sharedOutcome(decision: Decision | null) {
  if (!decision) return null;
  if (decision.action === "auto-accept") return "Offer accepted";
  if (decision.action === "human-approval") return "Buyer approval pending";
  return "Offer not accepted";
}

export function buildDealRoomView(
  perspective: DealRoomPerspective,
  input: DealRoomInput,
): DealRoomView {
  const { requirement, offer, decision, evidence, supplierName } = input;
  const phase = decision
    ? "closed"
    : offer?.needsConfirmation
      ? "clarification"
      : offer
        ? "policy-review"
        : "awaiting-offer";
  const timeline: SharedRoomState["timeline"] = [
    {
      actor: "Buyer",
      label: "Requirement shared",
      detail: `${requirement.quantity} ${requirement.unit} · ${requirement.product} · ${requirement.deliveryLocation}`,
    },
  ];

  if (offer) {
    timeline.push({
      actor: "Supplier",
      label: "Offer captured",
      detail: offer.needsConfirmation
        ? "Commercial terms require clarification"
        : `${offer.commitments.length} verbal commitments confirmed`,
    });
    for (const correction of offer.corrections.slice(0, 1)) {
      timeline.push({
        actor: "Karoboli",
        label: "Correction preserved",
        detail: `₹${correction.before.toLocaleString("en-IN")} → ₹${correction.after.toLocaleString("en-IN")}`,
      });
    }
  }

  const outcome = sharedOutcome(decision);
  if (outcome) {
    timeline.push({
      actor: "Karoboli",
      label: "Governed outcome",
      detail: outcome,
    });
  }

  const shared: SharedRoomState = {
    roomId: "KR-BLR-0726",
    phase,
    requirement: {
      product: requirement.product,
      specification: requirement.specification,
      quantity: requirement.quantity,
      unit: requirement.unit,
      deliveryLocation: requirement.deliveryLocation,
      requiredBy: requirement.requiredBy,
    },
    latestOffer: offer
      ? {
          totalPrice: offer.totalPrice,
          deliveryDate: offer.deliveryDate,
          paymentTerm: offer.paymentTerm,
          commitments: offer.commitments,
        }
      : null,
    timeline,
  };

  if (perspective === "buyer") {
    return {
      ...shared,
      perspective,
      privateState: {
        maximumBudget: requirement.maximumBudget,
        decisionAction: decision?.action ?? "pending",
        evidenceId: evidence?.id ?? null,
      },
    };
  }

  return {
    ...shared,
    perspective,
    supplierState: {
      supplierName,
      confirmationRequired: Boolean(offer?.needsConfirmation),
      outcome: !offer
        ? "awaiting-offer"
        : offer.needsConfirmation
          ? "clarification-required"
          : decision?.action === "auto-accept"
            ? "accepted"
            : decision?.action === "human-approval"
              ? "approval-pending"
              : decision?.action === "reject"
                ? "not-accepted"
                : "approval-pending",
    },
  };
}
