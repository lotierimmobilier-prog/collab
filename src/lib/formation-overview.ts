// Agrégation pour l'espace de contrôle de la formation (parrains / filleuls).
// Calcule, côté serveur, l'avancement de chaque filleul, les alertes de retard,
// les scores aux QCM, et la charge par parrain. Réutilisé par l'API et le
// rapport imprimable.
import { prisma } from "@/lib/prisma";
import { getExtras, filleulsOf } from "@/lib/user-extras";

export const RETARD_DAYS = 21; // sans activité depuis 21 j et non terminé → en retard

export interface OvModule { id: string; title: string; order: number; competences: { id: string; title: string; order: number }[] }
export interface OvPerson { id: string; prenom: string; nom: string }
export interface OvFilleul {
  id: string; prenom: string; nom: string; email: string | null; active: boolean;
  parrain: OvPerson | null;
  total: number; done: number; partial: number; progress: number; // progress 0..1
  quiz: { answered: number; correct: number; rate: number | null };
  lastActivity: string | null;
  status: "termine" | "en_cours" | "en_retard" | "jamais";
  perModule: { moduleId: string; done: number; total: number }[];
}
export interface OvParrain { id: string; prenom: string; nom: string; filleulsCount: number; avgProgress: number; enRetard: number }
export interface Overview {
  modules: OvModule[];
  filleuls: OvFilleul[];
  parrains: OvParrain[];
  kpi: { filleuls: number; avgProgress: number; doneCompetences: number; termine: number; enRetard: number; jamais: number; avgQuiz: number | null };
  retardDays: number;
  generatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ts(d: any): number { if (!d) return 0; const t = new Date(d).getTime(); return isNaN(t) ? 0 : t; }

export async function computeOverview(currentUserId: string, isAdmin: boolean): Promise<Overview> {
  const generatedAt = new Date().toISOString();
  const empty: Overview = { modules: [], filleuls: [], parrains: [], kpi: { filleuls: 0, avgProgress: 0, doneCompetences: 0, termine: 0, enRetard: 0, jamais: 0, avgQuiz: null }, retardDays: RETARD_DAYS, generatedAt };

  // Modules actifs + compétences + bonne réponse de chaque question (scoring QCM).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let modules: any[] = [];
  try {
    modules = await prisma.trainingModule.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { competences: { orderBy: { order: "asc" }, include: { questions: { select: { id: true, correctIndex: true } } } } },
    });
  } catch { return empty; }

  const ovModules: OvModule[] = modules.map(m => ({
    id: m.id, title: m.title, order: m.order,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competences: m.competences.map((c: any) => ({ id: c.id, title: c.title, order: c.order })),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allComps: any[] = modules.flatMap(m => m.competences);
  const totalComps = allComps.length;
  const compToModule = new Map<string, string>();
  const questionCorrect = new Map<string, number>(); // questionId → correctIndex
  for (const m of modules) for (const c of m.competences) {
    compToModule.set(c.id, m.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const q of c.questions) questionCorrect.set(q.id, q.correctIndex);
  }

  // Population des filleuls.
  const all = await prisma.user.findMany({
    select: { id: true, prenom: true, nom: true, email: true, active: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
  const byId = new Map(all.map(u => [u.id, u]));
  const extras = await getExtras(all.map(u => u.id));
  const parrainOf = (id: string): string | null => extras.get(id)?.parrainId ?? null;

  const filleulIds = isAdmin
    ? all.filter(u => parrainOf(u.id)).map(u => u.id)
    : await filleulsOf(currentUserId);
  if (!filleulIds.length) return { ...empty, modules: ovModules };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vals: any[] = [];
  try {
    vals = await prisma.competenceValidation.findMany({ where: { filleulId: { in: filleulIds } } });
  } catch { vals = []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valsByFilleul = new Map<string, any[]>();
  for (const v of vals) { const arr = valsByFilleul.get(v.filleulId) ?? []; arr.push(v); valsByFilleul.set(v.filleulId, arr); }

  const filleuls: OvFilleul[] = filleulIds.map(fid => {
    const u = byId.get(fid)!;
    const pid = parrainOf(fid);
    const pu = pid ? byId.get(pid) : null;
    const myVals = valsByFilleul.get(fid) ?? [];
    const valByComp = new Map(myVals.map(v => [v.competenceId, v]));

    let done = 0, partial = 0, answered = 0, correct = 0, last = 0;
    const perModule = new Map<string, { done: number; total: number }>();
    for (const m of modules) perModule.set(m.id, { done: 0, total: m.competences.length });

    for (const c of allComps) {
      const v = valByComp.get(c.id);
      const mid = compToModule.get(c.id)!;
      const pm = perModule.get(mid)!;
      if (v) {
        // Validée dès que le filleul OU le parrain valide.
        const validated = v.parrainValidated || v.filleulValidated;
        if (validated) { done++; pm.done++; }
        else if (Array.isArray(v.dates) && v.dates.length) partial++;
        last = Math.max(last, ts(v.updatedAt), ts(v.parrainValidatedAt), ts(v.filleulValidatedAt));
        if (Array.isArray(v.dates)) for (const d of v.dates) last = Math.max(last, ts(d));
        if (v.quiz && typeof v.quiz === "object") {
          for (const [qid, idx] of Object.entries(v.quiz)) {
            if (!questionCorrect.has(qid)) continue;
            answered++;
            if (questionCorrect.get(qid) === idx) correct++;
          }
        }
      }
    }

    const progress = totalComps ? done / totalComps : 0;
    let status: OvFilleul["status"];
    if (totalComps && done === totalComps) status = "termine";
    else if (last === 0) status = "jamais";
    else if (Date.now() - last > RETARD_DAYS * 86400000) status = "en_retard";
    else status = "en_cours";

    return {
      id: u.id, prenom: u.prenom, nom: u.nom, email: u.email, active: u.active,
      parrain: pu ? { id: pu.id, prenom: pu.prenom, nom: pu.nom } : null,
      total: totalComps, done, partial, progress,
      quiz: { answered, correct, rate: answered ? correct / answered : null },
      lastActivity: last ? new Date(last).toISOString() : null,
      status,
      perModule: [...perModule.entries()].map(([moduleId, v]) => ({ moduleId, done: v.done, total: v.total })),
    };
  });

  // Charge par parrain.
  const pMap = new Map<string, OvParrain & { _sum: number }>();
  for (const f of filleuls) {
    if (!f.parrain) continue;
    const p = pMap.get(f.parrain.id) ?? { id: f.parrain.id, prenom: f.parrain.prenom, nom: f.parrain.nom, filleulsCount: 0, avgProgress: 0, enRetard: 0, _sum: 0 };
    p.filleulsCount++; p._sum += f.progress;
    if (f.status === "en_retard" || f.status === "jamais") p.enRetard++;
    pMap.set(f.parrain.id, p);
  }
  const parrains: OvParrain[] = [...pMap.values()].map(p => ({ id: p.id, prenom: p.prenom, nom: p.nom, filleulsCount: p.filleulsCount, avgProgress: p.filleulsCount ? p._sum / p.filleulsCount : 0, enRetard: p.enRetard }))
    .sort((a, b) => b.enRetard - a.enRetard || a.avgProgress - b.avgProgress);

  const n = filleuls.length;
  const quizFilleuls = filleuls.filter(f => f.quiz.rate !== null);
  const kpi = {
    filleuls: n,
    avgProgress: n ? filleuls.reduce((s, f) => s + f.progress, 0) / n : 0,
    doneCompetences: filleuls.reduce((s, f) => s + f.done, 0),
    termine: filleuls.filter(f => f.status === "termine").length,
    enRetard: filleuls.filter(f => f.status === "en_retard").length,
    jamais: filleuls.filter(f => f.status === "jamais").length,
    avgQuiz: quizFilleuls.length ? quizFilleuls.reduce((s, f) => s + (f.quiz.rate ?? 0), 0) / quizFilleuls.length : null,
  };

  // Tri : en retard d'abord, puis avancement croissant.
  const rank = { en_retard: 0, jamais: 1, en_cours: 2, termine: 3 };
  filleuls.sort((a, b) => rank[a.status] - rank[b.status] || a.progress - b.progress || a.nom.localeCompare(b.nom));

  return { modules: ovModules, filleuls, parrains, kpi, retardDays: RETARD_DAYS, generatedAt };
}
