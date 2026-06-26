import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arr = (v: any) => (Array.isArray(v) ? v : []);
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// POST /api/ods/[id]/exchange — l'agence poste un message ou dépose une pièce.
//   { action:"message", body }
//   { action:"files", kind, files:[{name,mime,size,data}] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { prenom: true, nom: true } });
  const who = `${me?.prenom ?? ""} ${me?.nom ?? ""}`.trim() || "Agence";

  const o = await prisma.serviceOrder.findUnique({ where: { id }, select: { messages: true, supplierFiles: true } });
  if (!o) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  if (body?.action === "message") {
    const text = String(body?.body ?? "").trim().slice(0, 4000);
    if (!text) return NextResponse.json({ error: "Message vide." }, { status: 400 });
    data.messages = [...arr(o.messages), { id: rid(), author: "agence", name: who, body: text, at: now }];
  } else if (body?.action === "files") {
    const kind = ["devis", "facture", "photo", "autre"].includes(body?.kind) ? body.kind : "autre";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files = arr(body?.files).filter((f: any) => f?.data && f?.name).slice(0, 12).map((f: any) => ({
      id: rid(), kind, name: String(f.name).slice(0, 200), mime: String(f.mime || "application/octet-stream"),
      size: Number(f.size) || 0, data: String(f.data), at: now, by: who,
    }));
    if (!files.length) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
    data.supplierFiles = [...arr(o.supplierFiles), ...files];
  } else {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  await prisma.serviceOrder.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
