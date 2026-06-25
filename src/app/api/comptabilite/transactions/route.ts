import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta, normalizeLabel, SERVICE_IDS } from "@/lib/comptabilite";

async function guard() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!canAccessCompta(session.user.roleId)) return { err: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

/** GET ?accountId=&service=&from=&to=&limit= */
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const sp = req.nextUrl.searchParams;
  const accountId = sp.get("accountId") || undefined;
  const service = sp.get("service") || undefined;
  const from = sp.get("from"); const to = sp.get("to");
  const limit = parseInt(sp.get("limit") || "300");

  const where: Record<string, unknown> = {};
  if (accountId) where.accountId = accountId;
  if (service) where.service = service === "none" ? null : service;
  if (from || to) where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

  const transactions = await prisma.bankTransaction.findMany({ where, orderBy: { date: "desc" }, take: limit });
  return NextResponse.json({ transactions });
}

/** POST — saisie manuelle d'une opération. */
export async function POST(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const { accountId, date, label, amount, service, nature } = await req.json();
  if (!accountId || !date || !label?.trim() || amount == null || amount === "")
    return NextResponse.json({ error: "Compte, date, libellé et montant requis" }, { status: 400 });
  const txn = await prisma.bankTransaction.create({
    data: {
      accountId, date: new Date(date), label: label.trim(), amount: Number(amount),
      service: SERVICE_IDS.includes(service) ? service : null,
      nature: nature?.trim() || null, source: "manual", createdById: g.session!.user!.id,
    },
  });
  return NextResponse.json({ transaction: txn }, { status: 201 });
}

/** PATCH — corrige le service/nature/récurrence (et mémorise la correction). */
export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const { id, service, nature, recurring } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const txn = await prisma.bankTransaction.update({
    where: { id },
    data: {
      ...(service !== undefined ? { service: SERVICE_IDS.includes(service) ? service : null } : {}),
      ...(nature !== undefined ? { nature: nature?.trim() || null } : {}),
      ...(recurring !== undefined ? { recurring: !!recurring } : {}),
    },
  });

  // Auto-apprentissage : la correction manuelle alimente la mémoire par libellé.
  if (service !== undefined && SERVICE_IDS.includes(service)) {
    const pattern = normalizeLabel(txn.label);
    if (pattern) {
      await prisma.txnMemory.upsert({
        where: { pattern },
        create: { pattern, service, recurring: !!txn.recurring, occurrences: 1, lastDate: txn.date },
        update: { service, lastDate: txn.date },
      }).catch(() => {});
    }
  }
  return NextResponse.json({ transaction: txn });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.bankTransaction.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
