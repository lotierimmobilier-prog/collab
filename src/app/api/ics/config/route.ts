import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { encryptSecret } from "@/lib/ics-crypto";

const ID = "default";

async function guard() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { error: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

/** GET /api/ics/config — configuration sans le mot de passe (jamais renvoyé). */
export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const cfg = await prisma.icsConfig.findUnique({ where: { id: ID } });
  if (!cfg) {
    return NextResponse.json({
      config: {
        authBaseUrl: "https://auth.ics.fr/auth", realm: "Production",
        clientId: "myics-customer", portalUrl: "https://my.ics.fr",
        apiBaseUrl: null, username: null, enabled: false,
        hasPassword: false, lastTestAt: null, lastTestOk: false, lastError: null,
      },
    });
  }
  const { passwordEnc, ...rest } = cfg;
  return NextResponse.json({ config: { ...rest, hasPassword: !!passwordEnc } });
}

/** POST /api/ics/config — enregistre la configuration. Mot de passe chiffré. */
export async function POST(req: NextRequest) {
  const g = await guard();
  if ("error" in g) return g.error;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const f of ["authBaseUrl", "realm", "clientId", "portalUrl"] as const) {
    if (typeof body[f] === "string" && body[f].trim()) data[f] = body[f].trim();
  }
  if ("apiBaseUrl" in body) data.apiBaseUrl = body.apiBaseUrl ? String(body.apiBaseUrl).trim() : null;
  if ("username" in body) data.username = body.username ? String(body.username).trim() : null;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  // Mot de passe : chiffré seulement s'il est fourni et non vide (sinon inchangé).
  if (typeof body.password === "string" && body.password.length > 0) {
    data.passwordEnc = encryptSecret(body.password);
  }
  data.updatedById = g.session.user.id ?? null;

  const cfg = await prisma.icsConfig.upsert({
    where: { id: ID },
    update: data,
    create: { id: ID, ...data },
  });
  const { passwordEnc, ...rest } = cfg;
  return NextResponse.json({ config: { ...rest, hasPassword: !!passwordEnc } });
}
