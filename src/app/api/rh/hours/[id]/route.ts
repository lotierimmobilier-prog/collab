import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALIDATORS = ["admin", "dirigeant", "direction"];

// PATCH /api/rh/hours/[id] — validation direction d'un relevé signé.
// body: { action: "validate"|"reject", note? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!VALIDATORS.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction." }, { status: 403 });
  const { id } = await params;

  const row = await prisma.monthlyHours.findUnique({ where: { id }, select: { id: true } });
  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  if (action !== "validate" && action !== "reject") return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { prenom: true, nom: true } });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    status: action === "validate" ? "valide" : "refuse",
    validatedById: session.user.id, validatedAt: new Date(),
    validationNote: body?.note?.trim() || null,
  };
  // La validation vaut signature de l'employeur (preuve : nom, horodatage, IP).
  if (action === "validate") {
    data.directionSignedAt = new Date();
    data.directionSignatureName = `${me?.prenom ?? ""} ${me?.nom ?? ""}`.trim() || null;
    data.directionSignatureIp = ip;
  }

  await prisma.monthlyHours.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
