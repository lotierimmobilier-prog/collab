import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// GET /api/public/assistance/[token] — infos minimales pour la page publique.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const r = await prisma.assistanceRequest.findUnique({
      where: { token },
      select: { role: true, contactName: true, address: true, status: true, description: true },
    });
    if (!r) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      role: r.role, contactName: r.contactName, address: r.address,
      status: r.status, description: r.description,
      agence: "Lotier Immobilier",
      alreadySubmitted: r.status !== "nouvelle",
    });
  } catch {
    return NextResponse.json({ error: "Lien indisponible." }, { status: 503 });
  }
}

// POST /api/public/assistance/[token] — le déclarant soumet sa demande.
//   body: { description, photos:[{name,mime,size,data}], contactName?, contactPhone? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.assistanceRequest.findUnique({ where: { token }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });

  const description = String(body?.description ?? "").trim().slice(0, 4000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photos = Array.isArray(body?.photos)
    ? (body.photos as any[]).filter(p => p?.data && p?.name).slice(0, 12).map(p => ({
        id: String(p.id ?? Math.random().toString(36).slice(2)),
        name: String(p.name).slice(0, 200),
        mime: String(p.mime ?? "image/jpeg"),
        size: Number(p.size) || 0,
        data: String(p.data),
      }))
    : [];

  if (!description && photos.length === 0) {
    return NextResponse.json({ error: "Décrivez le problème ou ajoutez au moins une photo." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { description: description || null, status: "soumise", submittedAt: new Date() };
  if (photos.length) data.photos = photos;
  if (body?.contactName) data.contactName = String(body.contactName).slice(0, 200);
  if (body?.contactPhone) data.contactPhone = String(body.contactPhone).slice(0, 40);

  try {
    await prisma.assistanceRequest.update({ where: { token }, data });
    return NextResponse.json({ ok: true, message: "Votre demande a bien été transmise à l'agence." });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
