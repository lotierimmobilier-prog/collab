import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";

// GET /api/direction/employees — liste des salariés de l'agence (statut
// « salarié ») avec le nombre de documents et la prochaine échéance, pour le
// module « Dossiers salariés » de la direction.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  let users: Array<{ id: string; prenom: string; nom: string; email: string; roleId: string }> = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    users = await prisma.user.findMany({
      where: { isEmployee: true } as any,
      select: { id: true, prenom: true, nom: true, email: true, roleId: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });
  } catch { users = []; }

  // Comptage des documents + prochaine échéance par salarié (résilient si la
  // table n'est pas encore migrée).
  const counts = new Map<string, number>();
  const nextExpiry = new Map<string, string>();
  try {
    const ids = users.map(u => u.id);
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs: any[] = await (prisma.employeeDocument.findMany as any)({
        where: { userId: { in: ids } },
        select: { userId: true, expiresAt: true },
      });
      for (const d of docs) {
        counts.set(d.userId, (counts.get(d.userId) ?? 0) + 1);
        if (d.expiresAt) {
          const iso = new Date(d.expiresAt).toISOString();
          const cur = nextExpiry.get(d.userId);
          if (!cur || iso < cur) nextExpiry.set(d.userId, iso);
        }
      }
    }
  } catch { /* table absente → compteurs vides */ }

  return NextResponse.json({
    items: users.map(u => ({
      ...u,
      name: `${u.prenom} ${u.nom}`.trim(),
      docCount: counts.get(u.id) ?? 0,
      nextExpiry: nextExpiry.get(u.id) ?? null,
    })),
  });
}
