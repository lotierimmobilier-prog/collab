import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FORMATION_SEED } from "@/lib/formation-seed";

// POST /api/formation/seed — charge le programme type (admin).
// N'écrase rien : ajoute uniquement les modules dont le titre n'existe pas encore.
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const existing = await prisma.trainingModule.findMany({ select: { title: true } });
  const have = new Set(existing.map(m => m.title.trim().toLowerCase()));

  let modulesCreated = 0, competencesCreated = 0, questionsCreated = 0;

  for (let mi = 0; mi < FORMATION_SEED.length; mi++) {
    const m = FORMATION_SEED[mi];
    if (have.has(m.title.trim().toLowerCase())) continue;
    const module = await prisma.trainingModule.create({
      data: { title: m.title, description: m.description ?? null, order: mi },
    });
    modulesCreated++;
    for (let ci = 0; ci < m.competences.length; ci++) {
      const c = m.competences[ci];
      const comp = await prisma.trainingCompetence.create({
        data: { moduleId: module.id, title: c.title, description: c.description ?? null, order: ci },
      });
      competencesCreated++;
      const qs = c.questions ?? [];
      for (let qi = 0; qi < qs.length; qi++) {
        const q = qs[qi];
        await prisma.trainingQuestion.create({
          data: {
            competenceId: comp.id,
            prompt: q.prompt,
            choices: q.choices,
            correctIndex: q.correctIndex,
            explanation: q.explanation ?? null,
            order: qi,
          },
        });
        questionsCreated++;
      }
    }
  }

  const message = modulesCreated === 0
    ? "Programme déjà chargé — aucun nouveau module ajouté."
    : `Programme type chargé : ${modulesCreated} module(s), ${competencesCreated} compétence(s), ${questionsCreated} question(s).`;
  return NextResponse.json({ ok: true, modulesCreated, competencesCreated, questionsCreated, message });
}
