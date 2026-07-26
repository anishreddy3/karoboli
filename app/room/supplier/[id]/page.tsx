"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DealRoom } from "@/components/DealRoom";
import { type StoredCaseMemory, caseMemorySchema } from "@/lib/case-memory";

export default function SupplierRoomPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const [memory, setMemory] = useState<StoredCaseMemory | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch(
      `/api/case-memory?id=${encodeURIComponent(caseId)}&perspective=supplier`,
      {
      cache: "no-store",
      },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load case data");
        const data = await res.json();
        const parsed = caseMemorySchema.safeParse(data.memory);
        if (parsed.success) {
          setMemory({ ...data.memory, ...parsed.data } as StoredCaseMemory);
        } else {
          throw new Error("Invalid case data format");
        }
      })
      .catch((err) => setError(err.message));
  }, [caseId]);

  if (error) {
    return <div style={{ padding: "40px" }}>Error: {error}</div>;
  }

  if (!memory) {
    return <div style={{ padding: "40px" }}>Loading Deal Room...</div>;
  }

  if (!memory.requirement || !memory.offer || !memory.decision) {
    return (
      <div style={{ padding: "40px" }}>
        Deal room is not ready yet. Awaiting full requirement, offer, and decision.
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <DealRoom
        requirement={memory.requirement}
        offer={memory.offer}
        decision={memory.decision}
        evidence={memory.evidence || null}
        supplierName={memory.selectedSupplier}
        fixedPerspective="supplier"
      />
    </div>
  );
}
