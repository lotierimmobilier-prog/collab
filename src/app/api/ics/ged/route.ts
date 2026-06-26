import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIcsGed } from "@/lib/ics";
import { isDirection } from "@/lib/direction";
import { encryptSecret } from "@/lib/ics-crypto";
import { gedLogin } from "@/lib/ics-ged";

export const runtime = "nodejs";
const ID = "default";

/** GET /api/ics/ged — état de la configuration GED (sans secrets). */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessIcsGed(session.user.roleId)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });

  const cfg = await prisma.icsConfig.findUnique({ where: { id: ID } });
  return NextResponse.json({
    ged: {
      societe: cfg?.gedSociete ?? "LOTIER",
      email: cfg?.gedEmail ?? null,
      hasPassword: !!cfg?.gedPasswordEnc,
      lastTestOk: cfg?.gedLastTestOk ?? false,
      lastError: cfg?.gedLastError ?? null,
      tokenExp: cfg?.gedTokenExp ?? null,
    },
  });
}

/** POST /api/ics/ged — enregistre les identifiants GED (mot de passe chiffré). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.societe === "string") data.gedSociete = body.societe.trim() || null;
  if (typeof body.email === "string") data.gedEmail = body.email.trim() || null;
  if (typeof body.password === "string" && body.password.length > 0) data.gedPasswordEnc = encryptSecret(body.password);
  data.updatedById = session.user.id ?? null;

  const cfg = await prisma.icsConfig.upsert({ where: { id: ID }, update: data, create: { id: ID, ...data } });
  return NextResponse.json({ ged: { societe: cfg.gedSociete, email: cfg.gedEmail, hasPassword: !!cfg.gedPasswordEnc } });
}

/** PUT /api/ics/ged — teste la connexion GED (login complet) et met en cache le jeton. */
export async function PUT() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const cfg = await prisma.icsConfig.findUnique({ where: { id: ID } });
  if (!cfg?.gedEmail || !cfg.gedSociete || !cfg.gedPasswordEnc) {
    return NextResponse.json({ ok: false, error: "Renseignez d'abord société, email et mot de passe GED." }, { status: 400 });
  }
  const { decryptSecret } = await import("@/lib/ics-crypto");
  const password = decryptSecret(cfg.gedPasswordEnc);
  const res = await gedLogin({ apiBase: cfg.gedApiBase, societe: cfg.gedSociete, email: cfg.gedEmail, password });

  await prisma.icsConfig.update({
    where: { id: ID },
    data: res.ok && res.session
      ? { gedToken: res.session.token, gedCle: res.session.cle, gedTokenExp: new Date(Date.now() + 23 * 3600_000), gedLastTestOk: true, gedLastError: null }
      : { gedLastTestOk: false, gedLastError: res.error ?? "Échec" },
  });

  return NextResponse.json({ ok: res.ok, portefeuille: res.session?.portefeuille ?? null, error: res.error ?? null });
}
