import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Supprimer dans l'ordre pour respecter les contraintes FK
  await prisma.bailTenant.deleteMany();
  await prisma.bail.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.mailAccountConfig.deleteMany();
  await prisma.internalMessage.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskGroup.deleteMany();
  await prisma.taskFamily.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.announcement.deleteMany();

  return NextResponse.json({ ok: true, message: "Données réinitialisées (utilisateurs conservés)" });
}
