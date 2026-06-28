import { NextRequest, NextResponse } from "next/server";
import { resolveClientByEmail, verifyOtp, signClientSession, setClientCookie } from "@/lib/client-auth";

// POST /api/client/auth/verify-code  body: { email, code }
export async function POST(req: NextRequest) {
  const { email, code } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  const c = String(code ?? "").trim();
  if (!e || !/^\d{6}$/.test(c)) return NextResponse.json({ ok: false, error: "Code invalide." }, { status: 400 });

  const client = await resolveClientByEmail(e);
  if (!client) return NextResponse.json({ ok: false, error: "Code invalide ou expiré." }, { status: 401 });
  if (!(await verifyOtp(e, c))) return NextResponse.json({ ok: false, error: "Code invalide ou expiré." }, { status: 401 });

  await setClientCookie(signClientSession(client));
  return NextResponse.json({ ok: true, client: { prenom: client.prenom, nom: client.nom } });
}
