import { listPending } from "@/db/approval-queue";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || process.env.KAROBOLI_TENANT_ID || "default";

  return Response.json({ items: listPending(tenantId) });
}
