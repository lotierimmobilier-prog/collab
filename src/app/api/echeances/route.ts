import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { docStatus, kindLabel } from "@/lib/legal-docs";

// Rôles qui voient les échéances « agence » (exploitation).
const AGENCY_ROLES = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

interface Echeance {
  id: string;
  category: string;   // perso | fournisseur | carte_pro | assurance_agence | vehicule | local
  label: string;
  who?: string;
  date: string;       // ISO
  daysLeft: number;
  status: "ok" | "soon" | "expired" | "none";
  link: string;
}

// GET /api/echeances — agrège toutes les dates de validité/échéance de l'app.
// Chacun voit ses documents personnels ; l'admin voit ceux de tous ; les rôles
// direction/gestion voient en plus les échéances d'exploitation (fournisseurs,
// cartes pro, assurances agence, véhicules, locaux).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const role = session.user.roleId ?? "";
  const isAdmin = role === "admin";
  const canSeeAgency = AGENCY_ROLES.includes(role);

  const now = new Date();
  const items: Echeance[] = [];
  const dayMs = 86_400_000;
  const push = (e: Omit<Echeance, "daysLeft" | "status">) => {
    const daysLeft = Math.floor((new Date(e.date).getTime() - now.getTime()) / dayMs);
    items.push({ ...e, daysLeft, status: docStatus(e.date, now) });
  };

  // ── Documents personnels (carte pro, assurance, ALUR…) ──
  try {
    const where = isAdmin ? { expiresAt: { not: null } } : { userId: uid, expiresAt: { not: null } };
    const docs = await prisma.personalDocument.findMany({
      where, select: { id: true, kind: true, label: true, expiresAt: true, userId: true },
    });
    const names = new Map<string, string>();
    if (isAdmin && docs.length) {
      const users = await prisma.user.findMany({ where: { id: { in: [...new Set(docs.map(d => d.userId))] } }, select: { id: true, prenom: true, nom: true } });
      for (const u of users) names.set(u.id, `${u.prenom} ${u.nom}`.trim());
    }
    for (const d of docs) {
      if (!d.expiresAt) continue;
      push({
        id: `perso-${d.id}`, category: "perso",
        label: kindLabel(d.kind) + (d.label ? ` — ${d.label}` : ""),
        who: d.userId === uid ? "Vous" : (names.get(d.userId) ?? "Collaborateur"),
        date: new Date(d.expiresAt).toISOString(), link: "/mon-espace",
      });
    }
  } catch { /* table absente */ }

  if (canSeeAgency) {
    // ── Fournisseurs : assurance + URSSAF ──
    try {
      // findMany typé en « any » : les colonnes insurance/urssaf sont récentes
      // (le client Prisma local peut être en retard ; le build CI les a).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sup: any[] = await (prisma.supplier.findMany as any)({ where: { active: true }, select: { id: true, name: true, insuranceExpiry: true, urssafExpiry: true } });
      for (const s of sup) {
        if (s.insuranceExpiry) push({ id: `sup-ins-${s.id}`, category: "fournisseur", label: `Assurance — ${s.name}`, who: "Fournisseur", date: new Date(s.insuranceExpiry).toISOString(), link: "/fournisseurs" });
        if (s.urssafExpiry) push({ id: `sup-urs-${s.id}`, category: "fournisseur", label: `URSSAF — ${s.name}`, who: "Fournisseur", date: new Date(s.urssafExpiry).toISOString(), link: "/fournisseurs" });
      }
    } catch { /* colonnes absentes */ }

    // ── Cartes professionnelles ──
    try {
      const cards = await prisma.proCard.findMany({ where: { expiryDate: { not: null } }, select: { id: true, holderName: true, expiryDate: true } });
      for (const c of cards) if (c.expiryDate) push({ id: `card-${c.id}`, category: "carte_pro", label: `Carte pro — ${c.holderName}`, who: c.holderName, date: new Date(c.expiryDate).toISOString(), link: "/direction?tab=cartes" });
    } catch { /* table absente */ }

    // ── Assurances de l'agence ──
    try {
      const pols = await prisma.insurancePolicy.findMany({ where: { endDate: { not: null } }, select: { id: true, type: true, insurer: true, endDate: true } });
      for (const p of pols) if (p.endDate) push({ id: `pol-${p.id}`, category: "assurance_agence", label: `Assurance agence — ${p.insurer || p.type}`, who: "Agence", date: new Date(p.endDate).toISOString(), link: "/direction?tab=assurances" });
    } catch { /* table absente */ }

    // ── Véhicules : contrôle technique + fin de leasing/location ──
    try {
      const veh = await prisma.vehicle.findMany({ select: { id: true, label: true, immatriculation: true, controleTechnique: true, endDate: true, holdType: true } });
      for (const v of veh) {
        const tag = v.immatriculation ? ` (${v.immatriculation})` : "";
        if (v.controleTechnique) push({ id: `veh-ct-${v.id}`, category: "vehicule", label: `Contrôle technique — ${v.label}${tag}`, who: "Véhicule", date: new Date(v.controleTechnique).toISOString(), link: "/direction?tab=flotte" });
        if (v.endDate && v.holdType !== "propriete") push({ id: `veh-end-${v.id}`, category: "vehicule", label: `Fin ${v.holdType === "leasing" ? "leasing" : "location"} — ${v.label}${tag}`, who: "Véhicule", date: new Date(v.endDate).toISOString(), link: "/direction?tab=flotte" });
      }
    } catch { /* table absente */ }

    // ── Locaux : contrôles de sécurité (prochaine échéance) + fin de bail ──
    try {
      const prem = await prisma.premise.findMany({ select: { id: true, label: true, endDate: true, controls: true } });
      for (const p of prem) {
        if (p.endDate) push({ id: `prem-end-${p.id}`, category: "local", label: `Fin de bail — ${p.label}`, who: "Local", date: new Date(p.endDate).toISOString(), link: "/direction?tab=locaux" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const controls = Array.isArray(p.controls) ? (p.controls as any[]) : [];
        for (const c of controls) {
          if (c?.nextDate) push({ id: `prem-ctrl-${p.id}-${c.id ?? c.type}`, category: "local", label: `Contrôle ${c.type || "sécurité"} — ${p.label}`, who: "Local", date: new Date(c.nextDate).toISOString(), link: "/direction?tab=locaux" });
        }
      }
    } catch { /* table absente */ }
  }

  // Tri par date croissante (les plus urgentes / expirées d'abord).
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const counts = {
    expired: items.filter(i => i.status === "expired").length,
    soon: items.filter(i => i.status === "soon").length,
    total: items.length,
  };
  return NextResponse.json({ items, counts, canSeeAgency });
}
