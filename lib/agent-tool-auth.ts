export async function authorizeAgentTool(request: Request): Promise<Response | null> {
  const expected = process.env.AGENT_TOOL_SHARED_SECRET;
  if (!expected) {
    return Response.json(
      { error: "Agent tool authentication is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBytes = new TextEncoder().encode(expected);
  const suppliedBytes = new TextEncoder().encode(supplied);
  let mismatch = expectedBytes.length ^ suppliedBytes.length;
  const length = Math.max(expectedBytes.length, suppliedBytes.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |=
      (expectedBytes[index] || 0) ^ (suppliedBytes[index] || 0);
  }

  return mismatch === 0
    ? null
    : Response.json({ error: "Agent tool authentication failed." }, { status: 401 });
}
