import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/** GET /api/admin/auguste-logs?q=  → journal des demandes à Auguste (admin only). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const logs = await prisma.augusteLog.findMany({
    where: q ? {
      OR: [
        { userName: { contains: q, mode: "insensitive" } },
        { question: { contains: q, mode: "insensitive" } },
        { reply:    { contains: q, mode: "insensitive" } },
      ],
    } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json({ logs });
}
