import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta, normalizeLabel } from "@/lib/comptabilite";
import { parseStatement, ParsedTxn } from "@/lib/comptaImport";
import { MODELS, getAnthropic, normalizeError } from "@/lib/auguste";

export const maxDuration = 60;

// Extraction des opérations d'un relevé PDF via Claude (lecture du document).
async function extractPdf(base64: string): Promise<ParsedTxn[]> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MODELS.smart,
    max_tokens: 4000,
    system: "Tu extrais les opérations d'un relevé bancaire. Réponds UNIQUEMENT en JSON.",
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: `Extrais toutes les opérations de ce relevé bancaire.
Réponds par un tableau JSON, un objet par opération :
[{"date":"YYYY-MM-DD","label":"libellé complet","amount":-123.45}]
- amount négatif pour un débit, positif pour un crédit.
- Ignore les lignes de solde, de total et d'en-tête.` },
      ],
    }],
  });
  const text = resp.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as Array<{ date?: string; label?: string; amount?: number }>;
    return arr.filter(t => t.date && t.amount != null).map(t => ({
      date: new Date(t.date as string).toISOString(),
      label: String(t.label || "Opération").slice(0, 200),
      amount: Number(t.amount),
    }));
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!canAccessCompta(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

    const { accountId, format, content } = await req.json();
    if (!accountId || !format || !content) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    // 1) Extraction des opérations
    let parsed: ParsedTxn[] = [];
    if (format === "pdf") parsed = await extractPdf(content);
    else parsed = parseStatement(format, content);

    if (parsed.length === 0) return NextResponse.json({ ok: true, imported: 0, classified: 0, message: "Aucune opération détectée." });

    // 2) Mémoire par libellé pour pré-classer
    const patterns = [...new Set(parsed.map(t => normalizeLabel(t.label)).filter(Boolean))];
    const memories = await prisma.txnMemory.findMany({ where: { pattern: { in: patterns } } });
    const memByPattern = new Map(memories.map(m => [m.pattern, m]));

    const importId = `imp_${session.user.id}_${parsed.length}_${parsed[0]?.date ?? ""}`.slice(0, 60);

    let imported = 0, classified = 0;
    for (const t of parsed) {
      const pattern = normalizeLabel(t.label);
      const mem = memByPattern.get(pattern);
      const service = mem?.service ?? null;
      if (service) classified++;

      // Dédoublonnage léger : même compte + date + montant + libellé
      const dup = await prisma.bankTransaction.findFirst({
        where: { accountId, date: new Date(t.date), amount: t.amount, label: t.label },
        select: { id: true },
      });
      if (dup) continue;

      await prisma.bankTransaction.create({
        data: {
          accountId, date: new Date(t.date), label: t.label, amount: t.amount,
          service, recurring: mem?.recurring ?? false,
          source: format, importId, createdById: session.user.id,
        },
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported, classified, total: parsed.length });
  } catch (err) {
    const e = normalizeError(err);
    console.error("[comptabilite/import]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  }
}
