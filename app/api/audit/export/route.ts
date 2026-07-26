import { queryEvents } from "@/db/audit";
import { redactEvent, formatNdjson } from "@/lib/audit";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || process.env.KAROBOLI_TENANT_ID;
  const limit = Number(url.searchParams.get("limit")) || 1000;
  const offset = Number(url.searchParams.get("offset")) || 0;

  const events = queryEvents(tenantId, limit, offset);
  const redacted = events.map(redactEvent);
  const ndjson = formatNdjson(redacted);

  return new Response(ndjson, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="audit-${tenantId || "all"}-${new Date().toISOString()}.ndjson"`,
    },
  });
}
