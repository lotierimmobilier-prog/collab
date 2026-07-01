import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchFeed, analyzeFeed } from "@/lib/veille";
import { canManageContent } from "@/lib/superadmin";

const DAY = 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

// Récupère et ré-analyse un flux, puis persiste le résultat.
async function refreshFeed(id: string, title: string, url: string) {
  try {
    const items = await fetchFeed(url);
    const analysis = await analyzeFeed(title, items);
    await prisma.$executeRawUnsafe(
      `UPDATE veille_feed SET items = $1::jsonb, analysis = $2, "lastAnalyzedAt" = CURRENT_TIMESTAMP, "lastError" = NULL WHERE id = $3`,
      JSON.stringify(items), analysis, id,
    );
  } catch (e) {
    await prisma.$executeRawUnsafe(
      `UPDATE veille_feed SET "lastError" = $1, "lastAnalyzedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
      e instanceof Error ? e.message : String(e), id,
    ).catch(() => {});
  }
}

// GET — familles + flux (visibles par tout le monde). Déclenche en arrière-plan
// la ré-analyse des flux non rafraîchis depuis plus de 24h.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let families: Row[] = [], feeds: Row[] = [];
  try {
    families = await prisma.$queryRawUnsafe(`SELECT id, name, color FROM veille_family ORDER BY name ASC`);
    feeds = await prisma.$queryRawUnsafe(`SELECT id, "familyId", title, url, analysis, items, "lastAnalyzedAt", "lastError" FROM veille_feed ORDER BY "createdAt" DESC`);
  } catch { /* tables absentes → vide */ }

  // Ré-analyse (24h) en tâche de fond pour ne pas bloquer l'affichage.
  const stale = feeds.filter(f => !f.lastAnalyzedAt || (Date.now() - new Date(f.lastAnalyzedAt).getTime()) > DAY);
  if (stale.length) {
    after(async () => { for (const f of stale) await refreshFeed(f.id, f.title, f.url); });
  }

  return NextResponse.json({ families, feeds, canManage: canManageContent(session.user) });
}

// POST — créer une famille ou un flux (admin uniquement). Les autres
// utilisateurs sont en consultation / analyse.
// { kind: "family", name, color } | { kind: "feed", title, url, familyId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.kind === "family") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO veille_family (id, name, color, "createdBy") VALUES ($1, $2, $3, $4)`,
      id, name, String(body.color ?? "#B8966A"), session.user.id,
    );
    return NextResponse.json({ ok: true, id });
  }

  if (body.kind === "feed") {
    const title = String(body.title ?? "").trim();
    const url = String(body.url ?? "").trim();
    if (!title || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Titre et URL de flux valides requis" }, { status: 400 });
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO veille_feed (id, "familyId", title, url, "createdBy") VALUES ($1, $2, $3, $4, $5)`,
      id, body.familyId ? String(body.familyId) : null, title, url, session.user.id,
    );
    // Première analyse immédiate (en tâche de fond).
    after(async () => { await refreshFeed(id, title, url); });
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: "kind invalide" }, { status: 400 });
}

// DELETE — supprimer un flux ou une famille. ?kind=feed|family&id=...
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManageContent(session.user)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (kind === "family") {
    await prisma.$executeRawUnsafe(`UPDATE veille_feed SET "familyId" = NULL WHERE "familyId" = $1`, id).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM veille_family WHERE id = $1`, id).catch(() => {});
  } else {
    await prisma.$executeRawUnsafe(`DELETE FROM veille_feed WHERE id = $1`, id).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
