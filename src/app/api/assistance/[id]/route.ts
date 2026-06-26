import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

// GET /api/assistance/[id] — détail (avec photos).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { id } = await params;
  const r = await prisma.assistanceRequest.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(r);
}

// PATCH /api/assistance/[id] — maj statut / clôture.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body?.status) data.status = body.status;
  if (body?.contactName !== undefined) data.contactName = body.contactName || null;
  if (body?.contactPhone !== undefined) data.contactPhone = body.contactPhone || null;
  if (body?.address !== undefined) data.address = body.address || null;
  try {
    const r = await prisma.assistanceRequest.update({ where: { id }, data });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
