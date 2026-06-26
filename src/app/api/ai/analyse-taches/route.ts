import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MODELS, augusteJson, normalizeError } from "@/lib/auguste";

export const runtime = "nodejs";

interface Proposal {
  title: string;
  description?: string;
  priority?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  rationale?: string;
}

/**
 * POST /api/ai/analyse-taches — Auguste analyse l'état de l'agence (tâches en
 * cours, agenda, charge par personne) et propose de nouvelles tâches, chacune
 * attribuée à l'utilisateur le plus pertinent. Réservé direction + admin.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";
  if (!["admin", "direction", "dirigeant"].includes(role)) {
    return NextResponse.json({ error: "Réservé à la direction." }, { status: 403 });
  }

  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 86400_000);

  const [users, tasks, events] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, roleId: true } }),
    prisma.task.findMany({ where: { status: { not: "done" } }, orderBy: { createdAt: "desc" }, take: 120,
      select: { title: true, status: true, priority: true, dueDate: true, assigneeName: true } }),
    prisma.calendarEvent.findMany({ where: { start: { gte: now, lte: in14d } }, orderBy: { start: "asc" }, take: 60,
      select: { title: true, start: true } }),
  ]);

  type U = { id: string; prenom: string; nom: string; roleId: string };
  type T = { title: string; status: string; priority: string; dueDate: Date | null; assigneeName: string | null };
  type E = { title: string; start: Date };
  const usersStr = (users as U[]).map(u => `- ${u.prenom} ${u.nom} (id: ${u.id}, rôle: ${u.roleId})`).join("\n") || "(aucun)";
  const tasksStr = (tasks as T[]).map(t => `- [${t.priority}] ${t.title}${t.assigneeName ? ` — assigné à ${t.assigneeName}` : " — non assigné"}${t.dueDate ? `, échéance ${t.dueDate.toISOString().slice(0, 10)}` : ""}`).join("\n") || "(aucune tâche en cours)";
  const eventsStr = (events as E[]).map(e => `- ${e.start.toISOString().slice(0, 10)} : ${e.title}`).join("\n") || "(aucun événement)";
  const today = now.toISOString().slice(0, 10);

  const prompt = `Tu es Auguste, l'assistant de l'agence immobilière. Nous sommes le ${today}.
Analyse la situation ci-dessous et propose entre 3 et 6 NOUVELLES tâches concrètes, utiles et actionnables pour faire avancer l'agence. Évite les doublons avec les tâches déjà en cours. Pour chaque tâche, attribue-la à l'utilisateur le PLUS pertinent (selon son rôle et sa charge actuelle), propose une priorité et une échéance réaliste.

UTILISATEURS DISPONIBLES :
${usersStr}

TÂCHES EN COURS :
${tasksStr}

ÉVÉNEMENTS À VENIR (14 jours) :
${eventsStr}

Réponds UNIQUEMENT en JSON valide, sans texte autour, au format :
{"proposals":[{"title":"...","description":"...","priority":"urgent|haute|moyenne|basse","assigneeId":"<id exact d'un utilisateur ci-dessus>","assigneeName":"Prénom Nom","dueDate":"AAAA-MM-JJ","rationale":"pourquoi cette tâche et ce choix d'attribution"}]}`;

  try {
    const data = await augusteJson<{ proposals: Proposal[] }>({
      model: MODELS.smart,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }, { fallback: { proposals: [] } });

    // Valide les assignés contre la liste réelle.
    const byId = new Map((users as U[]).map(u => [u.id, `${u.prenom} ${u.nom}`]));
    const proposals = (data.proposals ?? []).slice(0, 8).map(p => {
      const validId = p.assigneeId && byId.has(p.assigneeId) ? p.assigneeId : null;
      return {
        title: String(p.title ?? "").trim(),
        description: String(p.description ?? "").trim(),
        priority: ["urgent", "haute", "moyenne", "basse"].includes(String(p.priority)) ? p.priority : "moyenne",
        assigneeId: validId,
        assigneeName: validId ? byId.get(validId)! : (p.assigneeName ?? null),
        dueDate: p.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? p.dueDate : null,
        rationale: String(p.rationale ?? "").trim(),
      };
    }).filter(p => p.title);

    return NextResponse.json({ proposals, users: (users as U[]).map(u => ({ id: u.id, name: `${u.prenom} ${u.nom}` })) });
  } catch (err) {
    const e = normalizeError(err);
    return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
  }
}
