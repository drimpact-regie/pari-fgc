import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { InvitationalRequestError, rejectInvitationalEventRequest } from "@/lib/invitationalRequests";

const rejectSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { requestId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  try {
    const result = await rejectInvitationalEventRequest(
      requestId,
      session.user.id,
      parsed.data.note?.trim() || null,
    );
    return NextResponse.json({ request: result });
  } catch (err) {
    if (err instanceof InvitationalRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
