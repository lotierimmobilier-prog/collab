import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta, normalizeLabel, SERVICE_IDS } from "@/lib/comptabilite";
import { MODELS, augusteJson, normalizeError } from "@/lib/auguste";

const SYSTEM = `Tu es Auguste, comptable de l'agence immobilière Lotier Immobilier.
Tu ventiles des opérations bancaires entre les services : vente, gestion, syndic, agence.
- vente : transactions, honoraires de vente, publicité annonces.
- gestion : gestion locative (loyers reversés, charges, honoraires de gestion).
- syndic : copropriétés (appels de fonds, charges, travaux votés).
- agence : frais généraux non rattachables (loyer agence, salaires, banque, fournitures, assurances).
Réponds UNIQUEMENT en JSON.`;

/** POST { accountId? , limit? } — classe par service les opérations non ventilées. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!canAccessCompta(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

    const { accountId, limit = 60 } = await req.json().catch(() => ({}));

    const todo = await prisma.bankTransaction.findMany({
      where: { service: null, ...(accountId ? { accountId } : {}) },
      orderBy: { date: "desc" },
      take: Math.min(limit, 80),
      select: { id: true, label: true, amount: true, date: true },
    });
    if (todo.length === 0) return NextResponse.json({ ok: true, classified: 0 });

    // Mémoire connue d'abord (gratuit)
    const patterns = [...new Set(todo.map(t => normalizeLabel(t.label)))];
    const memories = await prisma.txnMemory.findMany({ where: { pattern: { in: patterns } } });
    const memByPattern = new Map(memories.map(m => [m.pattern, m]));

    const fromMemory = todo.filter(t => memByPattern.get(normalizeLabel(t.label))?.service);
    const toAsk = todo.filter(t => !memByPattern.get(normalizeLabel(t.label))?.service);

    // Appel IA pour le reste
    let aiResults: Array<{ i: number; service?: string }> = [];
    if (toAsk.length > 0) {
      const list = toAsk.map((t, i) => `#${i} ${t.amount < 0 ? "débit" : "crédit"} ${Math.abs(t.amount).toFixed(2)}€ — ${t.label}`).join("\n");
      aiResults = await augusteJson<Array<{ i: number; service?: string }>>({
        model: MODELS.fast, max_tokens: 1500, system: SYSTEM,
        messages: [{ role: "user", content: `Ventile chacune de ces ${toAsk.length} opérations.\n${list}\n\nRéponds par un tableau JSON, même ordre :\n[{"i":0,"service":"vente|gestion|syndic|agence"}]` }],
      }, { fallback: [] });
    }
    const aiByIndex = new Map((Array.isArray(aiResults) ? aiResults : []).map(r => [r.i, r.service]));

    let classified = 0;
    const apply = async (txnId: string, label: string, date: Date, service: string | null) => {
      if (!service || !SERVICE_IDS.includes(service as never)) return;
      const pattern = normalizeLabel(label);
      // Récurrence : nombre d'occurrences de ce libellé dans l'historique
      const occ = await prisma.bankTransaction.count({ where: { label: { contains: label.slice(0, 20) } } });
      const recurring = occ >= 3;
      await prisma.bankTransaction.update({ where: { id: txnId }, data: { service, recurring } });
      if (pattern) {
        await prisma.txnMemory.upsert({
          where: { pattern },
          create: { pattern, service, recurring, occurrences: 1, lastDate: date },
          update: { service, recurring, occurrences: { increment: 1 }, lastDate: date },
        }).catch(() => {});
      }
      classified++;
    };

    for (const t of fromMemory) await apply(t.id, t.label, t.date, memByPattern.get(normalizeLabel(t.label))!.service);
    for (let i = 0; i < toAsk.length; i++) await apply(toAsk[i].id, toAsk[i].label, toAsk[i].date, aiByIndex.get(i) ?? null);

    return NextResponse.json({ ok: true, classified, total: todo.length });
  } catch (err) {
    const e = normalizeError(err);
    console.error("[comptabilite/classify]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  }
}
