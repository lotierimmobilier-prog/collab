import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Config publique (utilisateurs connectés) de l'assistant Auguste.
 * Expose uniquement l'avatar/logo configuré côté admin — pas les autres
 * réglages sensibles de /api/admin/settings.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ logoUrl: "" }, { status: 401 });

  try {
    const row = await prisma.setting.findUnique({ where: { key: "auguste_logo_url" } });
    return NextResponse.json({ logoUrl: row?.value ?? "" });
  } catch {
    return NextResponse.json({ logoUrl: "" });
  }
}
