import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/activity";

/** GET /api/admin/activity — synthèse présence + connexions + actions (admin). */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const today = todayKey();
  const days7: string[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); days7.push(todayKey(d)); }

  const [presence, logins, actions] = await Promise.all([
    prisma.userPresence.findMany({ where: { day: { in: days7 } } }),
    prisma.activityLog.findMany({ where: { kind: { in: ["login", "logout"] } }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.activityLog.findMany({ where: { kind: "action" }, orderBy: { createdAt: "desc" }, take: 120 }),
  ]);

  // Agrège la présence par utilisateur.
  const byUser = new Map<string, { userId: string; userName: string; todaySeconds: number; weekSeconds: number; lastSeen: string }>();
  for (const p of presence) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, { userId: p.userId, userName: p.userName ?? "—", todaySeconds: 0, weekSeconds: 0, lastSeen: p.lastSeen.toISOString() });
    const row = byUser.get(p.userId)!;
    row.weekSeconds += p.seconds;
    if (p.day === today) row.todaySeconds += p.seconds;
    if (p.lastSeen.toISOString() > row.lastSeen) row.lastSeen = p.lastSeen.toISOString();
    if ((p.userName ?? "") !== "") row.userName = p.userName!;
  }
  const presenceRows = [...byUser.values()].sort((a, b) => b.weekSeconds - a.weekSeconds);

  return NextResponse.json({ presence: presenceRows, logins, actions, today });
}
