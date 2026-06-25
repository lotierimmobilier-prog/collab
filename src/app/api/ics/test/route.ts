import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { decryptSecret } from "@/lib/ics-crypto";
import { icsLogin, icsGedLink } from "@/lib/ics";

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

  // Si l'authentification réussit, on vérifie aussi l'accès à la GED en
  // demandant le lien d'un bail d'exemple (le 1er de l'index ICS, s'il existe).
  let ged: { tested: boolean; ok: boolean; status?: number; detail?: string } = { tested: false, ok: false };
  if (result.ok && result.accessToken) {
    const sample = await prisma.icsTenant.findFirst({ select: { idBail: true } });
    if (sample) {
      const link = await icsGedLink(cfg, result.accessToken, { idBail: sample.idBail });
      ged = {
        tested: true, ok: link.ok, status: link.status,
        detail: link.ok ? "Lien GED obtenu : l'accès aux documents fonctionne." : (link.error ?? "Échec GedServlet"),
      };
    } else {
      ged = { tested: false, ok: false, detail: "Importez d'abord l'export Locataires pour tester l'accès aux documents." };
    }
  }

  await prisma.icsConfig.update({
    where: { id: ID },
    data: { lastTestAt: new Date(), lastTestOk: result.ok, lastError: result.ok ? null : (result.error ?? "Échec") },
  });

  return NextResponse.json({
    ok: result.ok,
    error: result.error ?? null,
    ropcUnsupported: result.ropcUnsupported ?? false,
    expiresIn: result.expiresIn ?? null,
    ged,
  });
}
