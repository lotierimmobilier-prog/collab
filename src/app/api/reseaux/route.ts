import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const KEY = "social_accounts";

// GET — comptes réseaux sociaux de l'agence (lecture pour tout utilisateur connecté).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const s = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  let accounts: unknown[] = [];
  try { accounts = s?.value ? JSON.parse(s.value) : []; } catch { accounts = []; }
  return NextResponse.json({ accounts });
}

// POST — { action: "save", accounts } (admin) | { action: "generate", brief, network }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b?.action === "save") {
    if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = Array.isArray(b?.accounts) ? b.accounts.map((a: any) => ({ network: String(a?.network ?? "").slice(0, 40), url: String(a?.url ?? "").slice(0, 300), label: String(a?.label ?? "").slice(0, 80) })).filter((a: { url: string }) => a.url) : [];
    await prisma.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(accounts) }, create: { key: KEY, value: JSON.stringify(accounts) } });
    return NextResponse.json({ ok: true, accounts });
  }

  if (b?.action === "generate") {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ post: "Le générateur n'est pas disponible (clé manquante)." });
    const brief = String(b?.brief ?? "").trim().slice(0, 1000);
    const network = String(b?.network ?? "Instagram").slice(0, 40);
    if (!brief) return NextResponse.json({ error: "Décrivez le bien ou l'idée du post." }, { status: 400 });
    const SYSTEM = `Tu es le community manager de l'agence Lotier Immobilier. Rédige un post ${network} en français, accrocheur et professionnel, à partir du brief de l'agent.
Règles : accroche forte en 1re ligne, 2-4 phrases vendeuses mais honnêtes, un appel à l'action (visite/contact), et 5 à 8 hashtags immobiliers pertinents en fin. Pas d'emoji à outrance (2-3 max). N'invente pas de prix/surface non fournis.`;
    try {
      const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 600, system: SYSTEM, messages: [{ role: "user", content: brief }] });
      const post = resp.content.filter(x => x.type === "text").map(x => (x as Anthropic.TextBlock).text).join("\n").trim() || "—";
      return NextResponse.json({ post });
    } catch { return NextResponse.json({ post: "Génération momentanément indisponible. Réessayez." }); }
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
