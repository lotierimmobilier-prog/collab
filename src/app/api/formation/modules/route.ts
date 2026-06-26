import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runMigrations } from "@/lib/run-migrations";

// GET /api/formation/modules — liste des modules + compétences (ordonnés).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const query = () => prisma.trainingModule.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      competences: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  try {
    return NextResponse.json({ modules: await query() });
  } catch (e) {
    // Auto-réparation si les tables Formation manquent encore.
    if (/does not exist|relation|table|column/i.test(String(e))) {
      try { await runMigrations(); return NextResponse.json({ modules: await query() }); }
      catch { return NextResponse.json({ modules: [] }); }
    }
    return NextResponse.json({ modules: [] });
  }
}

// POST /api/formation/modules — crée un module ou une compétence (admin).
//   body: { type:"module", title, description?, order? }
//      ou { type:"competence", moduleId, title, description?, order? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const body = await req.json();
  const type = body?.type;
  const title = (body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Titre obligatoire" }, { status: 400 });

  try {
    if (type === "module") {
      const m = await prisma.trainingModule.create({
        data: {
          title,
          description: body?.description?.trim() || null,
          order: Number.isFinite(body?.order) ? Number(body.order) : 0,
        },
      });
      return NextResponse.json(m);
    }
    if (type === "competence") {
      const moduleId = body?.moduleId;
      if (!moduleId) return NextResponse.json({ error: "moduleId obligatoire" }, { status: 400 });
      const c = await prisma.trainingCompetence.create({
        data: {
          moduleId,
          title,
          description: body?.description?.trim() || null,
          order: Number.isFinite(body?.order) ? Number(body.order) : 0,
        },
      });
      return NextResponse.json(c);
    }
    return NextResponse.json({ error: "type inconnu" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
