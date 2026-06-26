import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATES, defaultTemplate } from "@/lib/mail-templates";

// GET /api/admin/mail-templates — liste les modèles (version enregistrée
// fusionnée avec les valeurs par défaut + métadonnées/variables).
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  let saved: Record<string, { subject?: string; body?: string }> = {};
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: "mailtpl_" } } });
    for (const r of rows) {
      try { saved[r.key.slice("mailtpl_".length)] = JSON.parse(r.value); } catch { /* ignore */ }
    }
  } catch { saved = {}; }

  const templates = DEFAULT_TEMPLATES.map(t => ({
    ...t,
    subject: saved[t.id]?.subject ?? t.subject,
    body: saved[t.id]?.body ?? t.body,
    customized: !!saved[t.id],
  }));
  return NextResponse.json({ templates });
}

// POST /api/admin/mail-templates — enregistre un modèle { id, subject, body }.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!defaultTemplate(id)) return NextResponse.json({ error: "Modèle inconnu." }, { status: 400 });

  const value = JSON.stringify({ subject: String(body?.subject ?? ""), body: String(body?.body ?? "") });
  await prisma.setting.upsert({ where: { key: `mailtpl_${id}` }, update: { value }, create: { key: `mailtpl_${id}`, value } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/mail-templates?id=xxx — réinitialise un modèle (valeur défaut).
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const def = defaultTemplate(id);
  if (!def) return NextResponse.json({ error: "Modèle inconnu." }, { status: 400 });
  await prisma.setting.deleteMany({ where: { key: `mailtpl_${id}` } });
  return NextResponse.json({ ok: true, subject: def.subject, body: def.body });
}
