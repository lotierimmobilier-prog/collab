import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/protexa/sync — reçoit les compteurs de mandats par négociateur,
// envoyés par le robot Protexa qui tourne sur le VPS. Protégé par un secret
// partagé (en-tête « x-protexa-secret » == variable d'env PROTEXA_SYNC_SECRET).
// Aucune session utilisateur : c'est un appel machine-à-machine.
//
// Corps attendu :
//   { negociateurs: [{ name: "Barbara BOUBA", transaction: 12, gestion: 8 }, …] }
//
// Comportement : remplace l'ensemble des compteurs (les négociateurs absents du
// payload sont supprimés), et tente de rapprocher chaque nom d'un utilisateur
// Collab via prénom + nom (insensible à la casse/aux accents).

interface Incoming { name?: string; negociateur?: string; transaction?: number; gestion?: number }

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.PROTEXA_SYNC_SECRET;
  if (!secret) return NextResponse.json({ error: "Synchronisation Protexa non configurée (PROTEXA_SYNC_SECRET manquant)." }, { status: 503 });
  if (req.headers.get("x-protexa-secret") !== secret) return NextResponse.json({ error: "Secret invalide." }, { status: 401 });

  let body: { negociateurs?: Incoming[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const rows = Array.isArray(body?.negociateurs) ? body.negociateurs : [];
  if (!rows.length) return NextResponse.json({ error: "Aucun négociateur fourni." }, { status: 400 });

  // Table de rapprochement nom Protexa → utilisateur Collab.
  const users = await prisma.user.findMany({ select: { id: true, prenom: true, nom: true } }).catch(() => []);
  const byName = new Map<string, string>();
  for (const u of users) {
    byName.set(norm(`${u.prenom} ${u.nom}`), u.id);
    byName.set(norm(`${u.nom} ${u.prenom}`), u.id);
  }

  const seen: string[] = [];
  for (const r of rows) {
    const name = (r.name || r.negociateur || "").toString().trim();
    if (!name) continue;
    const transaction = Math.max(0, Math.round(Number(r.transaction) || 0));
    const gestion = Math.max(0, Math.round(Number(r.gestion) || 0));
    const userId = byName.get(norm(name)) ?? null;
    seen.push(name);
    await prisma.protexaMandate.upsert({
      where: { negociateur: name },
      create: { negociateur: name, transaction, gestion, userId },
      update: { transaction, gestion, userId },
    }).catch(() => {});
  }

  // Purge des négociateurs disparus du dernier export (best-effort).
  await prisma.protexaMandate.deleteMany({ where: { negociateur: { notIn: seen } } }).catch(() => {});

  // Horodatage de la dernière synchro.
  await prisma.setting.upsert({
    where: { key: "protexa_synced_at" },
    create: { key: "protexa_synced_at", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  }).catch(() => {});

  return NextResponse.json({ ok: true, count: seen.length });
}
