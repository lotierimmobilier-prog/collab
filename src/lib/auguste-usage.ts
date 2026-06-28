// Suivi de consommation d'Auguste (tokens + coût estimé) et plafond mensuel.
import { prisma } from "@/lib/prisma";

// Tarifs indicatifs en USD par MILLION de tokens (Claude Sonnet 4.6).
// Surchargés par les réglages auguste_price_in / auguste_price_out si présents.
const DEFAULT_PRICE_IN = 3;
const DEFAULT_PRICE_OUT = 15;
// Plafond mensuel par agent (tokens), par défaut 1 000 000.
export const DEFAULT_TOKEN_CAP = 1_000_000;

export interface Usage { input_tokens?: number; output_tokens?: number }

function monthStart(): Date { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }

async function num(key: string, def: number): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  const v = s?.value ? parseFloat(s.value) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : def;
}

export async function getPricing(): Promise<{ in: number; out: number }> {
  return { in: await num("auguste_price_in", DEFAULT_PRICE_IN), out: await num("auguste_price_out", DEFAULT_PRICE_OUT) };
}
export async function getTokenCap(): Promise<number> {
  const v = await num("auguste_token_cap", DEFAULT_TOKEN_CAP);
  return v > 0 ? Math.round(v) : DEFAULT_TOKEN_CAP;
}

export function estimateCost(inTok: number, outTok: number, price: { in: number; out: number }): number {
  return (inTok / 1e6) * price.in + (outTok / 1e6) * price.out;
}

// Enregistre un appel Auguste avec sa consommation. Best-effort, non bloquant.
export async function logAugusteUsage(opts: { userId?: string | null; userName?: string | null; feature: string; question?: string; reply?: string | null; usage?: Usage | null }): Promise<void> {
  try {
    await prisma.augusteLog.create({
      data: {
        userId: opts.userId || "system",
        userName: opts.userName || "—",
        feature: opts.feature,
        question: (opts.question || "").slice(0, 2000),
        reply: opts.reply ? opts.reply.slice(0, 4000) : null,
        inputTokens: opts.usage?.input_tokens ?? 0,
        outputTokens: opts.usage?.output_tokens ?? 0,
      },
    });
  } catch { /* table peut-être pas migrée → ignore */ }
}

// Consommation du mois en cours pour un agent.
export async function monthlyUsageFor(userId: string): Promise<{ inTok: number; outTok: number; total: number; cost: number }> {
  const price = await getPricing();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.augusteLog.findMany({ where: { userId, createdAt: { gte: monthStart() } }, select: { inputTokens: true, outputTokens: true } }).catch(() => []);
  const inTok = rows.reduce((s, r) => s + (r.inputTokens ?? 0), 0);
  const outTok = rows.reduce((s, r) => s + (r.outputTokens ?? 0), 0);
  return { inTok, outTok, total: inTok + outTok, cost: estimateCost(inTok, outTok, price) };
}

// Vérifie si l'agent est sous son plafond mensuel.
export async function augusteAllowed(userId: string): Promise<{ allowed: boolean; total: number; cap: number }> {
  const cap = await getTokenCap();
  const { total } = await monthlyUsageFor(userId);
  return { allowed: total < cap, total, cap };
}

// Synthèse mensuelle (tous agents) pour le tableau de bord super admin.
export async function monthlySummary(): Promise<{ month: string; cap: number; price: { in: number; out: number }; totalTokens: number; totalCost: number; agents: { userId: string; userName: string; inTok: number; outTok: number; total: number; cost: number }[] }> {
  const price = await getPricing();
  const cap = await getTokenCap();
  const since = monthStart();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped: any[] = await prisma.augusteLog.groupBy({
    by: ["userId", "userName"],
    where: { createdAt: { gte: since } },
    _sum: { inputTokens: true, outputTokens: true },
  }).catch(() => []);
  const agents = grouped.map(g => {
    const inTok = g._sum?.inputTokens ?? 0, outTok = g._sum?.outputTokens ?? 0;
    return { userId: g.userId as string, userName: (g.userName as string) || "—", inTok, outTok, total: inTok + outTok, cost: estimateCost(inTok, outTok, price) };
  }).sort((a, b) => b.total - a.total);
  const totalTokens = agents.reduce((s, a) => s + a.total, 0);
  const totalCost = agents.reduce((s, a) => s + a.cost, 0);
  return { month: since.toISOString().slice(0, 7), cap, price, totalTokens, totalCost, agents };
}

// Consommation/coût RÉELS du compte Claude via l'Admin API Anthropic (si une
// clé admin est configurée). Sinon null (on affiche l'estimation interne).
export async function realClaudeCost(): Promise<{ amountUsd: number; currency: string } | null> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) return null;
  try {
    const since = monthStart().toISOString().slice(0, 10);
    const r = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?starting_at=${since}`, {
      headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
    });
    if (!r.ok) return null;
    const d = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = d?.data ?? [];
    let amount = 0;
    for (const day of items) for (const res of (day.results ?? [])) amount += parseFloat(res.amount ?? "0") || 0;
    return { amountUsd: amount, currency: "USD" };
  } catch { return null; }
}
