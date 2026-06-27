import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";
import { getDashPrefs, defaultKpis, DASH_BLOCK_IDS } from "@/lib/dashboard-prefs";

// GET /api/dashboard/stats — indicateurs + blocs du tableau de bord, selon les
// préférences de l'utilisateur (sinon par défaut selon le rôle).
//   Renvoie { kpis: [{ label, value, sub? }], blocks: string[] }
interface Kpi { label: string; value: string; sub?: string }

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const role = session.user.roleId ?? "";

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const eur = (n: number) => n.toLocaleString("fr-FR") + " €";

  // ── Tâches (de l'utilisateur) ──
  let tasksDone = 0, avgDays: number | null = null, tasksOpen = 0;
  try {
    const done = await prisma.task.findMany({ where: { assigneeId: uid, completedAt: { gte: startMonth } }, select: { createdAt: true, completedAt: true } });
    tasksDone = done.length;
    if (done.length) avgDays = Math.max(0, Math.round((done.reduce((s, t) => s + (t.completedAt!.getTime() - t.createdAt.getTime()), 0) / done.length) / 86_400_000 * 10) / 10);
    tasksOpen = await prisma.task.count({ where: { assigneeId: uid, completedAt: null } });
  } catch { /* ignore */ }

  // ── Mails non lus (boîte de l'utilisateur) ──
  let mailsUnread = 0;
  try {
    const configs = await prisma.mailAccountConfig.findMany({ where: { sharedUserIds: { has: uid } }, select: { id: true } });
    const allowed = configs.map(c => c.id);
    mailsUnread = await prisma.emailMessage.count({ where: { read: false, folder: "INBOX", OR: [{ accountId: { in: allowed } }, { ownerId: uid }] } });
  } catch { /* ignore */ }

  // ── ODS en cours ──
  let odsOpen = 0;
  try { odsOpen = await prisma.serviceOrder.count({ where: { status: { notIn: ["terminé", "terminée", "annulé", "annulée"] } } }); } catch { /* ignore */ }

  // ── RDV de la semaine (événements créés par l'utilisateur) ──
  let rdvWeek = 0;
  try {
    const ws = new Date(now); ws.setDate(now.getDate() - ((now.getDay() + 6) % 7)); ws.setHours(0, 0, 0, 0);
    const we = new Date(ws); we.setDate(ws.getDate() + 7);
    rdvWeek = await prisma.calendarEvent.count({ where: { createdBy: uid, start: { gte: ws, lt: we } } });
  } catch { /* ignore */ }

  // ── CA (direction uniquement) ──
  let ca: { month: number; prevMonth: number; deltaPct: number | null } | null = null;
  if (canAccessCompta(role)) {
    try {
      const sum = async (gte: Date, lte: Date) => {
        const r = await prisma.bankTransaction.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, date: { gte, lte } } });
        return Math.round(r._sum.amount ?? 0);
      };
      const month = await sum(startMonth, now);
      const prevMonth = await sum(startPrev, endPrev);
      ca = { month, prevMonth, deltaPct: prevMonth > 0 ? Math.round(((month - prevMonth) / prevMonth) * 100) : null };
    } catch { /* ignore */ }
  }

  // ── Indicateurs par identifiant ──
  const pool: Record<string, Kpi> = {
    tasks_done: { label: "Tâches terminées · ce mois", value: String(tasksDone), ...(avgDays != null ? { sub: `≈ ${avgDays} j en moyenne` } : {}) },
    tasks_open: { label: "Tâches en cours", value: String(tasksOpen), sub: tasksOpen > 0 ? "à traiter" : "tout est à jour 🎉" },
    mails_unread: { label: "Mails non lus", value: String(mailsUnread), sub: mailsUnread > 0 ? "dans votre boîte" : "boîte à jour 🎉" },
    ods_open: { label: "ODS en cours", value: String(odsOpen), sub: odsOpen > 0 ? "interventions" : "rien en attente" },
    rdv_week: { label: "RDV cette semaine", value: String(rdvWeek), sub: rdvWeek > 0 ? "à votre agenda" : "agenda libre" },
  };
  if (ca) pool.ca_month = { label: "CA encaissé · ce mois", value: eur(ca.month), ...(ca.deltaPct != null ? { sub: `${ca.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(ca.deltaPct)} % vs mois préc.` } : {}) };

  // ── Sélection (préférences utilisateur, sinon défaut du rôle) ──
  const prefs = await getDashPrefs(uid);
  const selectedIds = (prefs.kpis && prefs.kpis.length ? prefs.kpis : defaultKpis(role)).slice(0, 4);
  const kpis = selectedIds.map(id => pool[id]).filter(Boolean) as Kpi[];

  const blocks = (prefs.blocks && prefs.blocks.length ? prefs.blocks : DASH_BLOCK_IDS).filter(b => DASH_BLOCK_IDS.includes(b));

  return NextResponse.json({ kpis, blocks });
}
