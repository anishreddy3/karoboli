import { listCalls } from "@/db/telephony";

export const runtime = "edge";

export async function GET() {
  return Response.json({ calls: listCalls() });
}
