import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FORMATION_SEED } from "@/lib/formation-seed";

const norm = (s: string) => s.trim().toLowerCase();

interface CompShape { id: string; title: string; prompts: Set<string>; count: number }
interface ModShape { id: string; title: string; comps: Map<string, CompShape>; count: number }

// POST /api/formation/seed — charge / complète le programme type (admin).
// Idempotent et additif : ajoute les modules, compétences ET questions
// manquants sans rien dupliquer ni écraser le contenu existant.
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = await prisma.trainingModule.findMany({
    include: { competences: { include: { questions: true } } },
  });

  const moduleByTitle = new Map<string, ModShape>();
  for (const m of existing) {
    const comps = new Map<string, CompShape>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (m.competences ?? []) as any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prompts = new Set<string>(((c.questions ?? []) as any[]).map((q: any) => norm(q.prompt)));
      comps.set(norm(c.title), { id: c.id, title: c.title, prompts, count: (c.questions ?? []).length });
    }
    moduleByTitle.set(norm(m.title), { id: m.id, title: m.title, comps, count: (m.competences ?? []).length });
  }

  let modulesCreated = 0, competencesCreated = 0, questionsCreated = 0;

  for (let mi = 0; mi < FORMATION_SEED.length; mi++) {
    const sm = FORMATION_SEED[mi];
    let mod = moduleByTitle.get(norm(sm.title));
    if (!mod) {
      const created = await prisma.trainingModule.create({
        data: { title: sm.title, description: sm.description ?? null, order: mi },
      });
      mod = { id: created.id, title: sm.title, comps: new Map(), count: 0 };
      moduleByTitle.set(norm(sm.title), mod);
      modulesCreated++;
    }

    for (let ci = 0; ci < sm.competences.length; ci++) {
      const sc = sm.competences[ci];
      let comp = mod.comps.get(norm(sc.title));
      if (!comp) {
        const created = await prisma.trainingCompetence.create({
          data: { moduleId: mod.id, title: sc.title, description: sc.description ?? null, order: mod.count + ci },
        });
        comp = { id: created.id, title: sc.title, prompts: new Set(), count: 0 };
        mod.comps.set(norm(sc.title), comp);
        competencesCreated++;
      }

      const sq = sc.questions ?? [];
      for (let qi = 0; qi < sq.length; qi++) {
        const q = sq[qi];
        if (comp.prompts.has(norm(q.prompt))) continue;
        await prisma.trainingQuestion.create({
          data: {
            competenceId: comp.id,
            prompt: q.prompt,
            choices: q.choices,
            correctIndex: q.correctIndex,
            explanation: q.explanation ?? null,
            order: comp.count + qi,
          },
        });
        comp.prompts.add(norm(q.prompt));
        questionsCreated++;
      }
    }
  }

  const parts: string[] = [];
  if (modulesCreated) parts.push(`${modulesCreated} module(s)`);
  if (competencesCreated) parts.push(`${competencesCreated} compétence(s)`);
  if (questionsCreated) parts.push(`${questionsCreated} question(s)`);
  const message = parts.length === 0
    ? "Programme déjà à jour — rien à ajouter."
    : `Programme complété : ${parts.join(", ")} ajouté(s).`;
  return NextResponse.json({ ok: true, modulesCreated, competencesCreated, questionsCreated, message });
}
