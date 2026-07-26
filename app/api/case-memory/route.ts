import { z } from "zod";
import {
  caseMemorySchema,
  type CaseMemory,
} from "@/lib/case-memory";
import {
  deleteCaseMemory,
  getCaseMemory,
  saveCaseMemory,
} from "@/lib/case-memory-store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const saveSchema = z.object({
  id: idSchema,
  memory: caseMemorySchema,
});

function ownerId(request: Request, caseId: string) {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  return email ? `user:${email}` : `case:${caseId}`;
}

function memoryError(error: unknown) {
  console.error("case-memory", error);
  return Response.json(
    { error: "Cloudflare case memory is temporarily unavailable." },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedId = idSchema.safeParse(url.searchParams.get("id"));
  if (!parsedId.success) {
    return Response.json({ error: "A valid case ID is required." }, { status: 400 });
  }

  try {
    const memory = await getCaseMemory(
      parsedId.data,
      ownerId(request, parsedId.data),
    );
    return memory
      ? Response.json({ memory })
      : Response.json({ memory: null }, { status: 404 });
  } catch (error) {
    return memoryError(error);
  }
}

export async function PUT(request: Request) {
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid case memory payload." }, { status: 400 });
  }

  try {
    const memory = await saveCaseMemory(
      parsed.data.id,
      ownerId(request, parsed.data.id),
      parsed.data.memory as CaseMemory,
    );
    if (!memory) {
      return Response.json(
        { error: "This case belongs to a different signed-in user." },
        { status: 403 },
      );
    }
    return Response.json({ memory });
  } catch (error) {
    return memoryError(error);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsedId = idSchema.safeParse(url.searchParams.get("id"));
  if (!parsedId.success) {
    return Response.json({ error: "A valid case ID is required." }, { status: 400 });
  }

  try {
    await deleteCaseMemory(parsedId.data, ownerId(request, parsedId.data));
    return new Response(null, { status: 204 });
  } catch (error) {
    return memoryError(error);
  }
}
