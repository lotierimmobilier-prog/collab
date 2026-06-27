import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { docStatus, runDueLegalReminders } from "@/lib/legal-docs";
import { runDueSupplierConfReminders } from "@/lib/supplier-conformite";

// GET /api/sidebar/badges — pastilles du menu pour l'utilisateur courant :
//   { mail: {count, urgent}, chat: {count, urgent}, legal: {count, urgent} }
// « urgent » = un élément non lu qui nécessite un traitement prioritaire.
const URGENT_RE = /urgent|relance|mise en demeure|impay|sinistre|fuite|d[ée]g[âa]t|d[ée]lai|mise en demeure/i;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;

  const result = { mail: { count: 0, urgent: false }, chat: { count: 0, urgent: false }, legal: { count: 0, urgent: false } };

  // Balayages quotidiens throttlés (sans bloquer) : rappels d'expiration des
  // documents perso + relances de conformité fournisseurs + relance décompte
  // d'heures le 25 du mois.
  void runDueLegalReminders();
  void runDueSupplierConfReminders();
  import("@/lib/rh-automation").then(m => m.runMonthlyHoursReminder()).catch(() => {});

  // ── Emails non lus (boîte de réception, cloisonné à l'utilisateur) ──
  try {
    const configs = await prisma.mailAccountConfig.findMany({ where: { sharedUserIds: { has: uid } }, select: { id: true } });
    const allowed = configs.map(c => c.id);
    const where = {
      read: false,
      folder: "INBOX",
      OR: [{ accountId: { in: allowed } }, { ownerId: uid }],
    };
    result.mail.count = await prisma.emailMessage.count({ where });
    if (result.mail.count > 0) {
      // Urgent = un email non lu marqué (étoile) ou dont l'objet correspond à
      // un mot-clé prioritaire.
      const sample = await prisma.emailMessage.findMany({ where, select: { subject: true, starred: true }, take: 80 });
      result.mail.urgent = sample.some(m => m.starred || URGENT_RE.test(m.subject || ""));
    }
  } catch { /* tables mail absentes → 0 */ }

  // ── Messages internes non lus (channels de l'utilisateur) ──
  try {
    const memberships = await prisma.channelMember.findMany({ where: { userId: uid }, select: { channelId: true } });
    const channelIds = memberships.map(m => m.channelId);
    if (channelIds.length) {
      const msgs = await prisma.internalMessage.findMany({
        where: { channelId: { in: channelIds }, NOT: { senderId: uid } },
        select: { content: true, readBy: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const unread = msgs.filter(m => !(m.readBy ?? []).includes(uid));
      result.chat.count = unread.length;
      result.chat.urgent = unread.some(m => URGENT_RE.test(m.content || ""));
    }
  } catch { /* tables chat absentes → 0 */ }

  // ── Documents administratifs : carte pro / assurance / ALUR à renouveler ──
  try {
    const docs = await prisma.personalDocument.findMany({
      where: { userId: uid, expiresAt: { not: null } },
      select: { expiresAt: true },
    });
    const statuses = docs.map(d => docStatus(d.expiresAt));
    const soon = statuses.filter(s => s === "soon").length;
    const expired = statuses.filter(s => s === "expired").length;
    result.legal.count = soon + expired;
    result.legal.urgent = expired > 0; // rouge dès qu'un document est expiré
  } catch { /* table absente → 0 */ }

  return NextResponse.json(result);
}
