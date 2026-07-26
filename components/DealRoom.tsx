"use client";

import { useState } from "react";
import type {
  BuyerRequirement,
  Decision,
  EvidenceRecord,
  SupplierOffer,
} from "@/lib/domain";
import {
  buildDealRoomView,
  type DealRoomPerspective,
} from "@/lib/deal-room";

type DealRoomProps = {
  requirement: BuyerRequirement;
  offer: SupplierOffer | null;
  decision: Decision | null;
  evidence: EvidenceRecord | null;
  supplierName: string;
  fixedPerspective?: DealRoomPerspective;
};

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function dateLabel(value: string) {
  if (value === "unknown") return "To be confirmed";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
}

const phaseLabels = {
  "awaiting-offer": "AWAITING OFFER",
  clarification: "CLARIFICATION OPEN",
  "policy-review": "READY FOR POLICY",
  closed: "OUTCOME RECORDED",
};

export function DealRoom({
  requirement,
  offer,
  decision,
  evidence,
  supplierName,
  fixedPerspective,
}: DealRoomProps) {
  const [perspective, setPerspective] = useState<DealRoomPerspective>(fixedPerspective || "buyer");
  const [manualEvents, setManualEvents] = useState<{ actor: string; label: string; detail: string }[]>([]);

  const room = buildDealRoomView(perspective, {
    requirement,
    offer,
    decision,
    evidence,
    supplierName,
  });

  const fullTimeline = [...room.timeline, ...manualEvents];

  const handleAction = (label: string, detail: string) => {
    setManualEvents((prev) => [
      ...prev,
      { actor: perspective === "buyer" ? "Buyer (Manual)" : "Supplier (Manual)", label, detail },
    ]);
  };

  return (
    <section className="deal-room" aria-label="Live negotiation room">
      <header className="deal-room-header">
        <div>
          <span>NEGOTIATION ROOM · {room.roomId}</span>
          <strong>One shared deal. Role-safe views.</strong>
        </div>
        <div className="room-header-actions">
          <span className={`room-phase ${room.phase}`}>
            {phaseLabels[room.phase]}
          </span>
          {!fixedPerspective && (
            <div className="room-perspective" aria-label="Deal room perspective">
              <button
                className={perspective === "buyer" ? "active" : ""}
                onClick={() => setPerspective("buyer")}
              >
                Buyer view
              </button>
              <button
                className={perspective === "supplier" ? "active" : ""}
                onClick={() => setPerspective("supplier")}
              >
                Supplier view
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="deal-room-body">
        <div className="room-summary">
          <div>
            <span>REQUIREMENT</span>
            <strong>
              {room.requirement.quantity} {room.requirement.unit} ·{" "}
              {room.requirement.product}
            </strong>
            <small>{room.requirement.specification}</small>
          </div>
          <div>
            <span>DELIVER TO</span>
            <strong>{room.requirement.deliveryLocation}</strong>
            <small>By {dateLabel(room.requirement.requiredBy)}</small>
          </div>
          <div>
            <span>LATEST OFFER</span>
            <strong>
              {room.latestOffer
                ? money(room.latestOffer.totalPrice)
                : "Listening…"}
            </strong>
            <small>
              {room.latestOffer
                ? `${dateLabel(room.latestOffer.deliveryDate)} · ${room.latestOffer.paymentTerm}`
                : "Supplier has not responded yet"}
            </small>
          </div>
        </div>

        <div className="room-detail-grid">
          <div className="room-timeline">
            <span>SHARED NEGOTIATION TRAIL</span>
            {fullTimeline.map((event, index) => (
              <div className="room-event" key={`${event.label}-${index}`}>
                <i />
                <div>
                  <small>{event.actor}</small>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {room.perspective === "buyer" ? (
            <div className="room-private buyer-private">
              <span>BUYER-ONLY CONTROLS</span>
              <div>
                <small>PRIVATE CEILING</small>
                <strong>{money(room.privateState.maximumBudget)}</strong>
              </div>
              <div>
                <small>AUTHORITY</small>
                <strong>
                  {room.privateState.decisionAction === "pending"
                    ? "Policy check pending"
                    : room.privateState.decisionAction.replace("-", " ")}
                </strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <small>MANUAL ACTIONS</small>
                <button onClick={() => handleAction("Price Negotiation", "Requested a 5% discount on total price.")}>Request Better Price</button>
                <button onClick={() => handleAction("Delivery Expedite", "Requested delivery 2 days earlier.")}>Demand Faster Delivery</button>
                <button onClick={() => handleAction("Approval Requested", "Purchase order sent for human approval under policy.")}>Request PO Approval</button>
                <button onClick={() => handleAction("Escalation", "Deal escalated to procurement manager.")}>Escalate to Human</button>
              </div>
              <p>
                Budget, competing offers and policy reasons never cross the supplier boundary.
              </p>
            </div>
          ) : (
            <div className="room-private supplier-private">
              <span>SUPPLIER LINK</span>
              <div>
                <small>SUPPLIER</small>
                <strong>{room.supplierState.supplierName}</strong>
              </div>
              <div>
                <small>STATUS</small>
                <strong>
                  {room.supplierState.outcome.replaceAll("-", " ")}
                </strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <small>MANUAL ACTIONS</small>
                <button onClick={() => handleAction("Counter Offer", "Proposed a new total price of ₹42,500.")}>Counter-Offer Price</button>
                <button onClick={() => handleAction("Schedule Update", "Delivery delayed by 1 day due to logistics.")}>Update Delivery Schedule</button>
                <button onClick={() => handleAction("Terms Accepted", "Supplier accepted the offer terms; buyer approval is still required.")}>Accept Terms</button>
                <button onClick={() => handleAction("RFQ Declined", "Unable to fulfil order requirements.")}>Decline RFQ</button>
              </div>
              <p>
                This view contains only the RFQ, this supplier&apos;s offer and the shared outcome.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
