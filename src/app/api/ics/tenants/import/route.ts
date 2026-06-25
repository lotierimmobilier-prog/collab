import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { parseIcsTenantsExport } from "@/lib/ics-import";

export const runtime = "nodejs";

/** POST /api/ics/tenants/import — multipart « file » : export ICS Locataires. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });

  let parsed;
  try {
    parsed = parseIcsTenantsExport(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: `Lecture du fichier impossible : ${(e as Error).message}` }, { status: 400 });
  }

  if (parsed.records.length === 0) {
    return NextResponse.json({ error: "Aucune ligne avec idBail trouvée. Vérifiez qu'il s'agit bien de l'export ICS « Locataires »." }, { status: 400 });
  }

  for (const r of parsed.records) {
    await prisma.icsTenant.upsert({ where: { idBail: r.idBail }, create: r, update: r });
  }
  const total = await prisma.icsTenant.count();

  return NextResponse.json({
    ok: true,
    imported: parsed.records.length,
    skipped: parsed.skipped,
    totalLignes: parsed.total,
    totalEnBase: total,
    message: `${parsed.records.length} bail/baux importés (${parsed.skipped} ligne(s) ignorée(s)). Index ICS : ${total} entrées.`,
  });
}
