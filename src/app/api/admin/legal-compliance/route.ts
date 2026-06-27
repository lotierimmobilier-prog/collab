import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DOC_KINDS, docStatus } from "@/lib/legal-docs";

// GET /api/admin/legal-compliance — vue conformité (ADMIN uniquement) :
// pour chaque utilisateur, l'état de ses documents administratifs/légaux.
// Les utilisateurs ordinaires ne voient que leurs propres documents
// (via /api/me/legal-documents) ; seul l'admin voit l'ensemble.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, prenom: true, nom: true, email: true, roleId: true },
    orderBy: [{ nom: "asc" }],
  });

  let docs: { id: string; userId: string; kind: string; label: string | null; number: string | null; expiresAt: Date | null; alurHours: number | null; fileName: string | null }[] = [];
  try {
    docs = await prisma.personalDocument.findMany({
      select: { id: true, userId: true, kind: true, label: true, number: true, expiresAt: true, alurHours: true, fileName: true },
    });
  } catch { docs = []; }

  const byUser = new Map<string, typeof docs>();
  for (const d of docs) {
    if (!byUser.has(d.userId)) byUser.set(d.userId, []);
    byUser.get(d.userId)!.push(d);
  }

  const now = new Date();
  const rows = users.map(u => {
    const list = (byUser.get(u.id) ?? []).map(d => ({
      id: d.id, kind: d.kind, label: d.label, number: d.number, alurHours: d.alurHours,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      status: docStatus(d.expiresAt, now),
      hasFile: !!d.fileName,
    }));
    // Pire statut parmi les documents suivis (carte pro + assurance prioritaires).
    const worst = list.reduce<string>((acc, d) => {
      const rank = (s: string) => (s === "expired" ? 3 : s === "soon" ? 2 : s === "none" ? 1 : 0);
      return rank(d.status) > rank(acc) ? d.status : acc;
    }, "ok");
    return { user: u, docs: list, worst };
  });

  return NextResponse.json({ kinds: DOC_KINDS, users: rows });
}
