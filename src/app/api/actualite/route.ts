import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchSourceArticles } from "@/lib/actualite";
import { canManageContent } from "@/lib/superadmin";

export const maxDuration = 60;
const DAY = 24 * 60 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

async function refreshSource(id: string, url: string) {
  try {
    const items = await fetchSourceArticles(url);
    await prisma.$executeRawUnsafe(
      `UPDATE actu_source SET items = $1::jsonb, "lastFetchedAt" = CURRENT_TIMESTAMP, "lastError" = NULL WHERE id = $2`,
      JSON.stringify(items), id,
    );
  } catch (e) {
    await prisma.$executeRawUnsafe(
      `UPDATE actu_source SET "lastError" = $1, "lastFetchedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
      e instanceof Error ? e.message : String(e), id,
    ).catch(() => {});
  }
}

// GET — sources + articles (consultation pour tous). Rafraîchit en tâche de
// fond les sources non actualisées depuis plus de 24 h.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let sources: Row[] = [];
  try {
    sources = await prisma.$queryRawUnsafe(`SELECT id, label, url, items, "lastFetchedAt", "lastError" FROM actu_source ORDER BY "createdAt" DESC`);
  } catch { /* table absente → vide */ }

  const stale = sources.filter(s => !s.lastFetchedAt || (Date.now() - new Date(s.lastFetchedAt).getTime()) > DAY);
  if (stale.length) after(async () => { for (const s of stale) await refreshSource(s.id, s.url); });

  return NextResponse.json({ sources, canManage: canManageContent(session.user) });
}

// POST — ajouter une source (admin uniquement) ou forcer un rafraîchissement.
// { url, label } | { refresh: id }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.refresh) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await prisma.$queryRawUnsafe(`SELECT id, url FROM actu_source WHERE id = $1`, String(body.refresh)).catch(() => [])) as any[];
    if (!rows[0]) return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
    await refreshSource(rows[0].id, rows[0].url);
    return NextResponse.json({ ok: true });
  }

  const label = String(body.label ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!label || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Nom et URL de site valides requis" }, { status: 400 });
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO actu_source (id, label, url, "createdBy") VALUES ($1, $2, $3, $4)`,
    id, label, url, session.user.id,
  );
  after(async () => { await refreshSource(id, url); });
  return NextResponse.json({ ok: true, id });
}

// DELETE ?id= — supprimer une source (admin uniquement).
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM actu_source WHERE id = $1`, id).catch(() => {});
  return NextResponse.json({ ok: true });
}
