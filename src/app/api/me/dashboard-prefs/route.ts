import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashPrefs, setDashPrefs, defaultKpis, availableKpis, DASH_BLOCKS, DASH_BLOCK_IDS } from "@/lib/dashboard-prefs";

// GET /api/me/dashboard-prefs — préférences + catalogues pour l'écran de
// personnalisation du tableau de bord.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";
  const prefs = await getDashPrefs(session.user.id);
  return NextResponse.json({
    kpis: prefs.kpis && prefs.kpis.length ? prefs.kpis : defaultKpis(role),
    blocks: prefs.blocks && prefs.blocks.length ? prefs.blocks : DASH_BLOCK_IDS,
    availableKpis: availableKpis(role),
    availableBlocks: DASH_BLOCKS,
  });
}

// POST /api/me/dashboard-prefs — enregistre la sélection. body: { kpis, blocks }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";
  const body = await req.json().catch(() => ({}));

  // Mise à jour partielle : un champ absent du corps conserve sa valeur
  // existante (permet de réordonner les KPI ou les blocs indépendamment).
  const existing = await getDashPrefs(session.user.id);
  const allowedKpis = new Set(availableKpis(role).map(k => k.id));
  const kpis = Array.isArray(body?.kpis)
    ? body.kpis.filter((x: unknown) => typeof x === "string" && allowedKpis.has(x)).slice(0, 4)
    : (existing.kpis ?? []);
  const blocks = Array.isArray(body?.blocks)
    ? body.blocks.filter((x: unknown) => typeof x === "string" && DASH_BLOCK_IDS.includes(x as string))
    : (existing.blocks ?? []);

  try {
    await setDashPrefs(session.user.id, { kpis, blocks });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
