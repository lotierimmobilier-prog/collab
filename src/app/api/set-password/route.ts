import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tokens = () => (prisma as any).passwordSetupToken;

async function validToken(token: string) {
  if (!token) return null;
  const row = await tokens().findUnique({ where: { token } }).catch(() => null);
  if (!row || row.usedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  return row as { id: string; userId: string };
}

// GET /api/set-password?token=… — valide le jeton et renvoie le prénom.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const row = await validToken(token);
  if (!row) return NextResponse.json({ ok: false, error: "Lien invalide ou expiré." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { prenom: true, email: true } }).catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "Compte introuvable." }, { status: 400 });
  return NextResponse.json({ ok: true, prenom: user.prenom, email: user.email });
}

// POST /api/set-password — { token, password } : définit le mot de passe.
export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 }); }
  const token = (body.token || "").trim();
  const password = body.password || "";
  if (password.length < 8) return NextResponse.json({ ok: false, error: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });

  const row = await validToken(token);
  if (!row) return NextResponse.json({ ok: false, error: "Lien invalide ou expiré." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }).catch(() => null);
  // Jeton consommé (usage unique).
  await tokens().update({ where: { id: row.id }, data: { usedAt: new Date() } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
