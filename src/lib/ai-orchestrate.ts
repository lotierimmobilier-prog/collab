// Orchestration multi-agents : Auguste (le chef d'orchestre) reçoit un
// objectif, choisit les assistants pertinents, leur délègue une sous-question,
// puis synthétise leurs contributions en une réponse finale.
import { augusteText, augusteJson, MODELS } from "@/lib/auguste";
import { resolveModel, retrieveContext } from "@/lib/ai-agents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentRow = any;

export interface Contribution { agentId: string; agentName: string; icon?: string | null; color?: string | null; question: string; answer: string }

// Interroge un assistant spécialisé (prompt système + base de connaissance).
async function askAgent(agent: AgentRow, question: string): Promise<string> {
  const context = await retrieveContext(agent.id, question).catch(() => "");
  const system = [
    agent.systemPrompt || "Tu es un assistant spécialisé d'une agence immobilière. Réponds en français.",
    "\n\nTu participes à un travail d'équipe coordonné par Auguste. Réponds à la sous-question qui t'est confiée dans TON domaine d'expertise, de façon concise et opérationnelle (Markdown).",
    context ? `\n\n# Base de connaissance de l'agence\n"""\n${context}\n"""` : "",
  ].join("");
  return augusteText({ model: resolveModel(agent.model), max_tokens: 1200, system, messages: [{ role: "user", content: question }] });
}

// Auguste choisit les assistants à mobiliser et la sous-question de chacun.
async function planDelegation(objective: string, agents: AgentRow[]): Promise<{ agentId: string; question: string }[]> {
  const list = agents.map(a => `- id:${a.id} · ${a.name}${a.specialty ? ` (${a.specialty})` : ""}${a.description ? ` — ${a.description}` : ""}`).join("\n");
  const arr = await augusteJson<{ agentId: string; question: string }[]>({
    model: MODELS.smart,
    max_tokens: 900,
    system: "Tu es Auguste, le chef d'orchestre des assistants IA de l'agence Lotier Immobilier. Réponds UNIQUEMENT en JSON.",
    messages: [{ role: "user", content: `Objectif : « ${objective} »\n\nAssistants disponibles :\n${list}\n\nChoisis UNIQUEMENT les assistants pertinents pour cet objectif (1 à 4). Pour chacun, formule une sous-question précise dans son domaine. Réponds par un tableau JSON :\n[{"agentId":"<id exact de la liste>","question":"..."}]` }],
  }, { fallback: [] });
  const valid = new Set(agents.map(a => a.id));
  return (Array.isArray(arr) ? arr : []).filter(x => x && valid.has(x.agentId) && x.question).slice(0, 4);
}

// Auguste synthétise les contributions en une réponse finale.
async function synthesize(objective: string, contributions: Contribution[]): Promise<string> {
  const body = contributions.map(c => `### ${c.agentName}\n**Question :** ${c.question}\n**Réponse :**\n${c.answer}`).join("\n\n");
  return augusteText({
    model: MODELS.smart,
    max_tokens: 1600,
    system: "Tu es Auguste, le chef d'orchestre. Tu synthétises les contributions des assistants en une réponse finale claire, structurée et actionnable en français (Markdown). Signale les points de vigilance et propose les prochaines étapes.",
    messages: [{ role: "user", content: `Objectif : « ${objective} »\n\nContributions des assistants :\n\n${body}\n\nRédige la synthèse finale pour l'utilisateur.` }],
  });
}

export interface OrchestrateResult { plan: { agentId: string; question: string }[]; contributions: Contribution[]; synthesis: string }

export async function orchestrate(objective: string, agents: AgentRow[]): Promise<OrchestrateResult> {
  if (!agents.length) {
    const solo = await augusteText({ model: MODELS.smart, max_tokens: 1400, system: "Tu es Auguste, l'assistant de l'agence Lotier Immobilier. Réponds en français (Markdown).", messages: [{ role: "user", content: objective }] });
    return { plan: [], contributions: [], synthesis: solo };
  }
  const plan = await planDelegation(objective, agents);
  const chosen = plan.length ? plan : agents.slice(0, 2).map(a => ({ agentId: a.id, question: objective }));
  const byId = new Map(agents.map(a => [a.id, a]));
  const contributions: Contribution[] = [];
  for (const step of chosen) {
    const agent = byId.get(step.agentId); if (!agent) continue;
    try {
      const answer = await askAgent(agent, step.question);
      contributions.push({ agentId: agent.id, agentName: agent.name, icon: agent.icon, color: agent.color, question: step.question, answer });
    } catch { /* on ignore un assistant en échec */ }
  }
  const synthesis = await synthesize(objective, contributions);
  return { plan: chosen, contributions, synthesis };
}
