import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";

async function guard() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!canAccessCompta(session.user.roleId)) return { err: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const g = await guard(); if (g.err) return g.err;
  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const { name, kind, openingBalance, threshold } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  const account = await prisma.bankAccount.create({
    data: {
      name: name.trim(),
      kind: ["gestion", "syndic", "agence"].includes(kind) ? kind : "agence",
      openingBalance: Number(openingBalance) || 0,
      threshold: threshold === "" || threshold == null ? null : Number(threshold),
      createdById: g.session!.user!.id,
    },
  });
  return NextResponse.json({ account }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const { id, name, kind, openingBalance, threshold } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const account = await prisma.bankAccount.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(kind !== undefined && ["gestion", "syndic", "agence"].includes(kind) ? { kind } : {}),
      ...(openingBalance !== undefined ? { openingBalance: Number(openingBalance) || 0 } : {}),
      ...(threshold !== undefined ? { threshold: threshold === "" || threshold == null ? null : Number(threshold) } : {}),
    },
  });
  return NextResponse.json({ account });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.bankAccount.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
