import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBlocked, addBlocked, removeBlocked } from "@/lib/mailBlocklist";

// Expéditeurs indésirables de l'utilisateur courant (cloisonné par ownerId).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ blocked: await listBlocked(session.user.id) });
}

// Bloque un expéditeur : ses prochains mails iront directement à la corbeille.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { email } = await req.json().catch(() => ({}));
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return NextResponse.json({ error: "Adresse invalide" }, { status: 400 });
  await addBlocked(session.user.id, e);
  return NextResponse.json({ ok: true, email: e });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string") return NextResponse.json({ error: "email requis" }, { status: 400 });
  await removeBlocked(session.user.id, email);
  return NextResponse.json({ ok: true });
}
