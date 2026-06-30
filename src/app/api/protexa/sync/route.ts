import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/protexa/sync — reçoit les compteurs de mandats par négociateur,
// envoyés par le robot Protexa qui tourne sur le VPS. Protégé par un secret
// partagé (en-tête « x-protexa-secret » == variable d'env PROTEXA_SYNC_SECRET).
// Aucune session utilisateur : c'est un appel machine-à-machine.
//
// Corps attendu (par trimestre — t/g = [T1, T2, T3, T4]) :
//   { negociateurs: [{ name: "Barbara BOUBA", t: [3,5,2,1], g: [4,6,0,0] }, …] }
// Rétro-compatible avec l'ancien format { transaction, gestion } (totaux).
//
// Comportement : remplace l'ensemble des compteurs (les négociateurs absents du
// payload sont supprimés), et tente de rapprocher chaque nom d'un utilisateur
// Collab via prénom + nom (insensible à la casse/aux accents).

interface Incoming { name?: string; negociateur?: string; transaction?: number; gestion?: number; t?: number[]; g?: number[] }

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Normalise un tableau de 4 trimestres (entiers ≥ 0).
function quad(arr: unknown, total: number): number[] {
  const a = Array.isArray(arr) ? arr.slice(0, 4).map((x) => Math.max(0, Math.round(Number(x) || 0))) : [];
  while (a.length < 4) a.push(0);
  // Si aucun détail trimestriel mais un total fourni, on met tout en année (T?) : on
  // laisse à zéro les trimestres et on s'appuiera sur le total annuel.
  void total;
  return a;
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
    const tQ = quad(r.t, Number(r.transaction) || 0);
    const gQ = quad(r.g, Number(r.gestion) || 0);
    // Total annuel = somme des trimestres si fournis, sinon le total transmis.
    const tSum = tQ.reduce((s, x) => s + x, 0);
    const gSum = gQ.reduce((s, x) => s + x, 0);
    const transaction = tSum || Math.max(0, Math.round(Number(r.transaction) || 0));
    const gestion = gSum || Math.max(0, Math.round(Number(r.gestion) || 0));
    const quarters = { t: tQ, g: gQ };
    const userId = byName.get(norm(name)) ?? null;
    seen.push(name);
    await prisma.protexaMandate.upsert({
      where: { negociateur: name },
      create: { negociateur: name, transaction, gestion, quarters, userId },
      update: { transaction, gestion, quarters, userId },
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

  // La demande de synchro éventuelle (déclenchée par le bouton du tableau de
  // bord) est consommée.
  await prisma.setting.upsert({
    where: { key: "protexa_sync_request" },
    create: { key: "protexa_sync_request", value: "" },
    update: { value: "" },
  }).catch(() => {});

  return NextResponse.json({ ok: true, count: seen.length });
}

// GET /api/protexa/sync — interrogé par le robot/poller du VPS (authentifié par
// le secret partagé) pour savoir si une synchronisation a été demandée depuis le
// tableau de bord. Renvoie { pending, requestedAt, lastSync }.
export async function GET(req: NextRequest) {
  const secret = process.env.PROTEXA_SYNC_SECRET;
  if (!secret) return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  if (req.headers.get("x-protexa-secret") !== secret) return NextResponse.json({ error: "Secret invalide." }, { status: 401 });

  const reqRow = await prisma.setting.findUnique({ where: { key: "protexa_sync_request" } }).catch(() => null);
  const lastRow = await prisma.setting.findUnique({ where: { key: "protexa_synced_at" } }).catch(() => null);
  const requestedAt = reqRow?.value || "";
  return NextResponse.json({ pending: !!requestedAt, requestedAt: requestedAt || null, lastSync: lastRow?.value || null });
}
