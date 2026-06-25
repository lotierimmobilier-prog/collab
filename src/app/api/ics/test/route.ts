import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { decryptSecret } from "@/lib/ics-crypto";
import { icsLogin } from "@/lib/ics";

const ID = "default";

/** POST /api/ics/test — tente une connexion à ICS avec les identifiants stockés. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const cfg = await prisma.icsConfig.findUnique({ where: { id: ID } });
  if (!cfg || !cfg.username || !cfg.passwordEnc) {
    return NextResponse.json({ ok: false, error: "Identifiants ICS non renseignés." }, { status: 400 });
  }

  const password = decryptSecret(cfg.passwordEnc);
  if (!password) {
    return NextResponse.json({ ok: false, error: "Impossible de déchiffrer le mot de passe (clé serveur modifiée ?). Ressaisissez-le." }, { status: 400 });
  }

  const result = await icsLogin(cfg, cfg.username, password);

  await prisma.icsConfig.update({
    where: { id: ID },
    data: { lastTestAt: new Date(), lastTestOk: result.ok, lastError: result.ok ? null : (result.error ?? "Échec") },
  });

  return NextResponse.json({
    ok: result.ok,
    error: result.error ?? null,
    ropcUnsupported: result.ropcUnsupported ?? false,
    expiresIn: result.expiresIn ?? null,
  });
}
