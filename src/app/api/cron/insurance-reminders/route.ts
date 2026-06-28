import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runInsuranceReminders } from "@/lib/insurance-reminders";

export const dynamic = "force-dynamic";

// Déclenchement des relances d'assurance. Protégé par un secret (CRON_SECRET,
// à défaut AUTH_SECRET) OU par une session interne authentifiée (déclenchement
// manuel depuis l'agence). La tâche est idempotente.
function tokenOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const qp = new URL(req.url).searchParams.get("token") || "";
  return bearer === secret || qp === secret;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  let allowed = tokenOk(req);
  if (!allowed) {
    const session = await auth();
    allowed = !!session?.user;
  }
  if (!allowed) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const report = await runInsuranceReminders();
  return NextResponse.json(report);
}

export const GET = handle;
export const POST = handle;
