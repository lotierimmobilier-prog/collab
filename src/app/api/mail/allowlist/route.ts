import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listAllowed, addAllowed, removeAllowed } from "@/lib/mailAllowlist";

// Expéditeurs de confiance de l'utilisateur courant (cloisonné par ownerId) :
// leurs mails restent toujours en boîte de réception.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ allowed: await listAllowed(session.user.id) });
}

// Remet un expéditeur en boîte de réception et le mémorise : ses prochains
// mails ne seront plus classés en « Publicité ». On corrige aussi ses mails
// déjà rangés en « pub » (retour immédiat en boîte de réception).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { email } = await req.json().catch(() => ({}));
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return NextResponse.json({ error: "Adresse invalide" }, { status: 400 });

  await addAllowed(session.user.id, e);

  // Corrige l'existant : les mails de cet expéditeur rangés en « pub » (et
  // rattachés à cet agent) repassent en boîte de réception.
  const pubMsgs = await prisma.emailMessage.findMany({
    where: { ownerId: session.user.id, fromEmail: { equals: e, mode: "insensitive" }, labels: { has: "pub" } },
    select: { id: true, labels: true },
  }).catch(() => [] as { id: string; labels: string[] }[]);
  for (const m of pubMsgs) {
    const fixed = m.labels.filter(l => l !== "pub");
    if (!fixed.includes("inbox")) fixed.push("inbox");
    await prisma.emailMessage.update({ where: { id: m.id }, data: { labels: fixed } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, email: e, moved: pubMsgs.length });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string") return NextResponse.json({ error: "email requis" }, { status: 400 });
  await removeAllowed(session.user.id, email);
  return NextResponse.json({ ok: true });
}
