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
}: DealRoomProps) {
  const [perspective, setPerspective] =
    useState<DealRoomPerspective>("buyer");
  const room = buildDealRoomView(perspective, {
    requirement,
    offer,
    decision,
    evidence,
    supplierName,
  });

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
            {room.timeline.map((event, index) => (
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
              <div>
                <small>EVIDENCE</small>
                <strong>{room.privateState.evidenceId ?? "Created at close"}</strong>
              </div>
              <p>
                Budget, competing offers and policy reasons never cross the
                supplier boundary.
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
              <div>
                <small>COMMITMENTS SHARED</small>
                <strong>{room.latestOffer?.commitments.length ?? 0}</strong>
              </div>
              <p>
                This view contains only the RFQ, this supplier&apos;s offer and
                the shared outcome.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
