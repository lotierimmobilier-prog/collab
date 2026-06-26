import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runMigrations } from "@/lib/run-migrations";

// POST /api/admin/migrate — applique les migrations à la demande (admin).
// Renvoie un rapport (instructions appliquées + présence des colonnes/tables).
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const report = await runMigrations();
  const ok = !report.error && Object.values(report.columns).every(Boolean) && Object.values(report.tables).every(Boolean);
  return NextResponse.json({ ok, report });
}

// GET = même chose, pour pouvoir le déclencher depuis le navigateur.
export async function GET() {
  return POST();
}
