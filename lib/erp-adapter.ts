import type { PurchaseOrder } from "./domain";

export type ErpWriteResult = {
  idempotencyKey: string;
  status: "created" | "already-exists" | "error";
  message?: string;
};

/**
 * Idempotent PO write adapter. Uses the PO id as the idempotency key.
 * If KAROBOLI_ERP_ADAPTER_URL is not configured, returns an error result.
 */
export async function writePurchaseOrderToErp(
  po: PurchaseOrder,
): Promise<ErpWriteResult> {
  const adapterUrl = (process.env.KAROBOLI_ERP_ADAPTER_URL || "").trim().replace(/\/$/, "");
  const secret = (process.env.KAROBOLI_ERP_ADAPTER_SECRET || "").trim();

  if (!adapterUrl) {
    return {
      idempotencyKey: po.id,
      status: "error",
      message: "ERP adapter not configured (KAROBOLI_ERP_ADAPTER_URL is missing).",
    };
  }

  try {
    const response = await fetch(`${adapterUrl}/purchase-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "Idempotency-Key": po.id,
      },
      body: JSON.stringify(po),
    });

    if (response.status === 409) {
      return { idempotencyKey: po.id, status: "already-exists" };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        idempotencyKey: po.id,
        status: "error",
        message: `ERP adapter returned ${response.status}: ${body.slice(0, 200)}`,
      };
    }

    return { idempotencyKey: po.id, status: "created" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ERP error";
    return { idempotencyKey: po.id, status: "error", message };
  }
}
