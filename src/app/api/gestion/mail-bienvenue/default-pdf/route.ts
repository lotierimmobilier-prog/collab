import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageContent } from "@/lib/superadmin";

export const maxDuration = 30;

// GET — nom du PDF joint par défaut (le cas échéant).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const s = await prisma.setting.findUnique({ where: { key: "welcome_default_pdf_name" } }).catch(() => null);
  return NextResponse.json({ name: s?.value ?? "" });
}

// POST { filename, content(base64) } — définit le PDF joint par défaut.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { filename, content } = await req.json().catch(() => ({}));
  const b64 = typeof content === "string" ? content : "";
  if (!b64) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  // ~7 Mo en base64 max.
  if (b64.length > 7 * 1024 * 1024 * 1.4) return NextResponse.json({ error: "PDF trop volumineux (max ~7 Mo)" }, { status: 413 });
  const name = String(filename || "document.pdf").slice(0, 200);
  await prisma.setting.upsert({ where: { key: "welcome_default_pdf" }, update: { value: b64 }, create: { key: "welcome_default_pdf", value: b64 } });
  await prisma.setting.upsert({ where: { key: "welcome_default_pdf_name" }, update: { value: name }, create: { key: "welcome_default_pdf_name", value: name } });
  return NextResponse.json({ ok: true, name });
}

// DELETE — retire le PDF joint par défaut (retour au RIB généré).
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  await prisma.setting.deleteMany({ where: { key: { in: ["welcome_default_pdf", "welcome_default_pdf_name"] } } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
