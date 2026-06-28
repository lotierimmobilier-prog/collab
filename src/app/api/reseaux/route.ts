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
    const styleId = String(b?.style ?? "pro").slice(0, 20);
    const degree = Math.min(3, Math.max(1, Number(b?.degree) || 2)); // 1 discret · 2 équilibré · 3 marqué
    if (!brief) return NextResponse.json({ error: "Décrivez le bien ou l'idée du post." }, { status: 400 });
    // Consignes de ton selon le style choisi par l'agent.
    const STYLES: Record<string, string> = {
      pro: "Ton professionnel et chaleureux, classique et rassurant. Vocabulaire soigné, accroche claire.",
      luxe: "Ton haut de gamme et élégant : vocabulaire raffiné, mise en valeur des prestations d'exception, des matériaux nobles et de l'art de vivre. Sobre, pas de superlatifs criards, 1 emoji maximum.",
      humour: "Ton léger et plein d'humour bienveillant : un trait d'esprit ou un jeu de mots immobilier, tout en restant pro. Le bien doit donner le sourire et l'envie de visiter.",
      jeune: "Ton dynamique et décontracté façon réseaux sociaux : phrases courtes, punchy, tutoiement, emojis bien placés, rythme énergique. Parfait pour Instagram/TikTok.",
      coupdecoeur: "Ton émotionnel et sensoriel : on raconte une histoire, la lumière, les moments de vie, le quartier. On fait rêver et se projeter (storytelling).",
      info: "Ton informatif et factuel : on met en avant les caractéristiques clés, les atouts concrets et les chiffres fournis, de façon claire et structurée. Peu d'emphase.",
    };
    const styleHint = STYLES[styleId] ?? STYLES.pro;
    const DEGREE: Record<number, string> = {
      1: "DEGRÉ DISCRET : applique ce style avec retenue et subtilité — il doit rester perceptible mais léger, le post demeure très sobre.",
      2: "DEGRÉ ÉQUILIBRÉ : applique ce style de façon nette et assumée, sans excès.",
      3: "DEGRÉ MARQUÉ : pousse ce style à fond, qu'il soit immédiatement reconnaissable et caractéristique (tout en restant publiable par une agence sérieuse).",
    };
    const SYSTEM = `Tu es le community manager de l'agence immobilière Lotier Immobilier. Tu produis un post ${network} en français, PRÊT À COPIER-COLLER tel quel sur le réseau social.

STYLE DEMANDÉ : ${styleHint}
${DEGREE[degree]}

FORMAT IMPOSÉ (structure le post sur plusieurs lignes, avec des sauts de ligne entre les blocs pour l'aération) :
1. Une accroche forte sur la 1re ligne, avec un emoji d'ouverture pertinent (🏡 ✨ 🔑 📍 …).
2. 2 à 4 lignes courtes et vendeuses qui décrivent le bien ou l'idée. Tu PEUX utiliser des puces avec emojis (ex. « 🛏️ 3 chambres », « 🌳 Jardin exposé sud », « 🚗 Garage ») quand des caractéristiques sont fournies.
3. Une ligne d'appel à l'action (CTA) claire et incitative : visite, message privé, lien en bio, contact… avec un emoji (📩 📞 👉).
4. Une dernière ligne avec 5 à 8 hashtags immobiliers pertinents (large + local), séparés par des espaces.

RÈGLES STRICTES :
- Réponds UNIQUEMENT par le texte du post final, sans introduction, sans commentaire, sans guillemets autour.
- Ne pose JAMAIS de question et ne demande jamais d'informations complémentaires : rédige toujours un post complet et publiable.
- N'invente jamais de prix, de surface ou de caractéristique chiffrée non fournis. Si une info manque, tourne la phrase autrement — ne laisse AUCUN crochet [comme ça] ni texte à compléter dans le résultat.
- Adapte le nombre d'emojis au style (sobre pour Luxe/Informatif, généreux pour Jeune & punchy).`;
    // Le brief peut contenir des [crochets] (texte d'exemple) : on neutralise le
    // risque que le modèle réponde « complétez les crochets » en le cadrant.
    const userMsg = `Brief de l'agent :\n${brief}\n\nRédige maintenant le post ${network} final, prêt à publier.`;
    try {
      const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 700, system: SYSTEM, messages: [{ role: "user", content: userMsg }] });
      const post = resp.content.filter(x => x.type === "text").map(x => (x as Anthropic.TextBlock).text).join("\n").trim() || "—";
      return NextResponse.json({ post });
    } catch { return NextResponse.json({ post: "Génération momentanément indisponible. Réessayez." }); }
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
