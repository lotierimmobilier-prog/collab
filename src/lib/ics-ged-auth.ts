// Obtention d'un jeton GED valide : réutilise le jeton mémorisé tant qu'il est
// valable (~24 h), sinon se reconnecte et le met en cache.
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/ics-crypto";
import { gedLogin, gedTokenValid } from "@/lib/ics-ged";
import { gedAccessLevel, GedLevel } from "@/lib/ics";

const ID = "default";

/** Niveau d'accès GED d'un utilisateur (réglage individuel sinon défaut du rôle). */
export async function gedLevelForUser(userId: string): Promise<GedLevel> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { roleId: true, gedAccess: true } });
    return gedAccessLevel(u?.roleId, u?.gedAccess);
  } catch {
    // Repli si la colonne gedAccess n'est pas encore appliquée en base.
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { roleId: true } }).catch(() => null);
    return gedAccessLevel(u?.roleId, null);
  }
}

export async function getValidGedToken(): Promise<{ token?: string; apiBase?: string | null; error?: string }> {
  const cfg = await prisma.icsConfig.findUnique({ where: { id: ID } });
  if (!cfg?.gedEmail || !cfg.gedSociete || !cfg.gedPasswordEnc) {
    return { error: "Accès GED non configuré." };
  }

  // Jeton encore valable ?
  if (cfg.gedToken && cfg.gedTokenExp && cfg.gedTokenExp.getTime() > Date.now() + 5 * 60_000) {
    if (await gedTokenValid(cfg.gedApiBase, cfg.gedToken)) return { token: cfg.gedToken, apiBase: cfg.gedApiBase };
  }

  const password = decryptSecret(cfg.gedPasswordEnc);
  if (!password) return { error: "Mot de passe GED indéchiffrable, ressaisissez-le." };

  const res = await gedLogin({ apiBase: cfg.gedApiBase, societe: cfg.gedSociete, email: cfg.gedEmail, password });
  if (!res.ok || !res.session) return { error: res.error ?? "Connexion GED échouée." };

  await prisma.icsConfig.update({
    where: { id: ID },
    data: { gedToken: res.session.token, gedCle: res.session.cle, gedTokenExp: new Date(Date.now() + 23 * 3600_000), gedLastTestOk: true, gedLastError: null },
  });
  return { token: res.session.token, apiBase: cfg.gedApiBase };
}
