// Données du dossier d'UN locataire, pour l'espace client. Toujours filtré par
// tenantId : un locataire n'accède qu'à son propre dossier.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("fr-FR")} €`;
const dfr = (d: Date) => new Date(d).toLocaleDateString("fr-FR");

// Situation de loyer : solde, prochaine échéance, derniers paiements.
export async function tenantLoyer(tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const links: any[] = await prisma.bailTenant.findMany({
    where: { tenantId },
    include: {
      bail: {
        include: {
          appels: { orderBy: { echeance: "asc" } },
          encaissements: { orderBy: { dateReglement: "desc" } },
          lot: true,
        },
      },
    },
  });

  if (!links.length) return { hasBail: false, message: "Aucun bail actif n'est rattaché à votre dossier. Contactez l'agence si besoin." };

  let totalAppels = 0, totalPaye = 0;
  const echeances: { periode: string; montant: string; echeance: string; status: string }[] = [];
  const paiements: { date: string; montant: string; mode: string }[] = [];
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let prochaineRaw: Date | null = null;
  let prochaine: { periode: string; montant: string; echeance: string } | null = null;

  for (const l of links) {
    const b = l.bail;
    if (!b) continue;
    for (const a of b.appels ?? []) {
      totalAppels += a.totalCC ?? 0;
      echeances.push({ periode: a.periode, montant: eur(a.totalCC ?? 0), echeance: dfr(a.echeance), status: a.status });
      const ech = new Date(a.echeance);
      if (a.status !== "regle" && ech >= cutoff && (!prochaineRaw || ech < prochaineRaw)) {
        prochaineRaw = ech;
        prochaine = { periode: a.periode, montant: eur(a.totalCC ?? 0), echeance: dfr(a.echeance) };
      }
    }
    for (const e of b.encaissements ?? []) {
      totalPaye += e.montant ?? 0;
      paiements.push({ date: dfr(e.dateReglement), montant: eur(e.montant ?? 0), mode: e.modePaiement ?? "" });
    }
  }

  const solde = totalAppels - totalPaye;       // > 0 = reste à payer
  return {
    hasBail: true,
    solde: eur(Math.abs(solde)),
    soldeStatut: solde > 0.5 ? "à payer" : solde < -0.5 ? "en avance / crédit" : "à jour",
    prochaineEcheance: prochaine ? { periode: prochaine.periode, montant: prochaine.montant, echeance: prochaine.echeance } : null,
    derniersPaiements: paiements.slice(0, 5),
    echeances: echeances.slice(-6),
  };
}

// Prochains rendez-vous du locataire (événements où il est participant).
export async function tenantRdv(tenantId: string, email: string) {
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = await prisma.calendarEvent.findMany({
    where: { start: { gte: now } },
    orderBy: { start: "asc" },
    take: 200,
  });
  const e = (email ?? "").trim().toLowerCase();
  const mine = events.filter(ev => {
    const att = Array.isArray(ev.attendees) ? ev.attendees : [];
    return att.some((a: { email?: string; id?: string }) =>
      (a?.email && String(a.email).toLowerCase() === e) || a?.id === tenantId);
  });
  return mine.slice(0, 5).map(ev => ({
    titre: ev.title,
    date: new Date(ev.start).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }),
    lieu: ev.location || null,
    type: ev.type || "rdv",
  }));
}

// Crée une demande d'assistance (visible côté agence) pour ce locataire.
export async function createTenantRequest(
  tenant: { id: string; prenom: string; nom: string; email: string },
  description: string,
): Promise<{ ok: boolean; ref?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t: any = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { phone: true, mobile: true, address: true } }).catch(() => null);
  const created = await prisma.assistanceRequest.create({
    data: {
      token: randomUUID(),
      role: "locataire",
      contactName: `${tenant.prenom} ${tenant.nom}`.trim(),
      contactEmail: tenant.email,
      contactPhone: t?.mobile || t?.phone || null,
      address: t?.address || null,
      description: description?.slice(0, 4000) || null,
      status: "soumise",
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  return { ok: true, ref: created.id.slice(-6).toUpperCase() };
}

// Statut d'une demande, vu côté locataire (libellé + couleur + ordre).
export const TENANT_REQUEST_STATUS: Record<string, { label: string; color: string; step: number }> = {
  nouvelle:  { label: "Reçue",                  color: "#2563eb", step: 1 },
  soumise:   { label: "Reçue",                  color: "#2563eb", step: 1 },
  ods_cree:  { label: "En cours de traitement", color: "#d97706", step: 2 },
  cloturee:  { label: "Traitée",                color: "#059669", step: 3 },
};
export function tenantRequestStatus(status: string) {
  return TENANT_REQUEST_STATUS[status] ?? TENANT_REQUEST_STATUS.soumise;
}

// Liste des demandes d'un locataire (rapprochées par email). Statut traduit
// pour un affichage clair côté locataire.
export async function listTenantRequests(tenant: { email: string }): Promise<{ ref: string; description: string | null; status: string; statusLabel: string; statusColor: string; step: number; createdAt: string; updatedAt: string }[]> {
  const email = (tenant.email ?? "").trim().toLowerCase();
  if (!email) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, description, status, "createdAt", "updatedAt"
         FROM assistance_requests
        WHERE role = 'locataire' AND lower("contactEmail") = $1
        ORDER BY "createdAt" DESC LIMIT 50`, email,
    );
    return rows.map(r => {
      const st = tenantRequestStatus(r.status);
      return {
        ref: String(r.id).slice(-6).toUpperCase(),
        description: r.description ?? null,
        status: r.status, statusLabel: st.label, statusColor: st.color, step: st.step,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };
    });
  } catch { return []; }
}
