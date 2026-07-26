import { getCall } from "@/db/telephony";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const call = getCall(id);
  if (!call) {
    return Response.json({ error: "Call record not found." }, { status: 404 });
  }
  return Response.json({ call });
}
