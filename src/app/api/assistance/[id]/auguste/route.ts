import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropic, MODELS } from "@/lib/auguste";

export const maxDuration = 60;
const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

// POST /api/assistance/[id]/auguste — Auguste analyse la demande (texte + photos)
// et propose : type d'intervention, urgence, fournisseur le plus adapté.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { id } = await params;

  const r = await prisma.assistanceRequest.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const suppliers = await prisma.supplier.findMany({
    where: { active: true },
    select: { id: true, name: true, type: true, metier: true, email: true },
    take: 300,
  });
  const supplierList = suppliers.map(s => `${s.id} | ${s.name} | ${s.metier || s.type}${s.email ? "" : " (sans email)"}`).join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photos = Array.isArray(r.photos) ? (r.photos as any[]) : [];
  for (const p of photos.slice(0, 5)) {
    if (p?.data && String(p.mime || "").startsWith("image/")) {
      content.push({ type: "image", source: { type: "base64", media_type: p.mime, data: String(p.data) } });
    }
  }
  content.push({ type: "text", text: `Demande d'assistance d'un ${r.role === "coproprietaire" ? "copropriétaire" : "locataire"}.
Adresse : ${r.address || "non précisée"}
Description du problème : ${r.description || "(aucune, voir photos)"}

Liste des fournisseurs disponibles (ID | nom | métier) :
${supplierList || "(aucun fournisseur)"}

Analyse le problème (et les photos si présentes) puis réponds en JSON STRICT :
{"interventionType":"<métier nécessaire: Plomberie, Électricité, Serrurerie, Chauffage, Vitrerie, Maçonnerie, Toiture…>","urgency":"normal|urgent","summary":"<résumé clair en 1-2 phrases du problème et de l'intervention à prévoir>","supplierId":"<ID du fournisseur le plus adapté dans la liste, ou vide si aucun ne correspond>","supplierName":"<nom>","confidence":<0 à 1>,"reason":"<pourquoi ce fournisseur / cette analyse>"}
- "urgent" si dégât des eaux actif, panne de chauffage en hiver, problème de sécurité (serrure, gaz, électricité dangereuse).
- Ne choisis un fournisseur que s'il correspond vraiment au métier ; sinon supplierId vide.` });

  let parsed: Record<string, unknown> = {};
  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: MODELS.smart, max_tokens: 700,
      system: "Tu es Auguste, assistant d'une agence immobilière. Tu analyses des demandes d'intervention et réponds uniquement en JSON valide.",
      messages: [{ role: "user", content }],
    });
    const text = resp.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) {
    return NextResponse.json({ error: "Analyse impossible : " + (e instanceof Error ? e.message : String(e)) }, { status: 502 });
  }

  // Validation de l'ID fournisseur proposé.
  const sid = String(parsed.supplierId ?? "");
  const sup = suppliers.find(s => s.id === sid);
  return NextResponse.json({
    ok: true,
    interventionType: parsed.interventionType ?? null,
    urgency: parsed.urgency === "urgent" ? "urgent" : "normal",
    summary: parsed.summary ?? null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    reason: parsed.reason ?? null,
    supplier: sup ? { id: sup.id, name: sup.name, email: sup.email, metier: sup.metier || sup.type } : null,
  });
}
