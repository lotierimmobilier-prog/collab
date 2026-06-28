import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runFormationReminders } from "@/lib/formation-reminders";

export const dynamic = "force-dynamic";

function tokenOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!secret) return false;
  const h = req.headers.get("authorization") || "";
  const bearer = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  const qp = new URL(req.url).searchParams.get("token") || "";
  return bearer === secret || qp === secret;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  let allowed = tokenOk(req);
  if (!allowed) { const s = await auth(); allowed = s?.user?.roleId === "admin"; }
  if (!allowed) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await runFormationReminders());
}

export const GET = handle;
export const POST = handle;
