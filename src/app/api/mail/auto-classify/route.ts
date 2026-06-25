import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MODELS, augusteJson, normalizeError } from "@/lib/auguste";

/**
 * Classement automatique « à la réception ».
 * Classe en UN seul appel modèle (rapide) les conversations entrantes
 * encore non classées : catégorie (type:), agent responsable (assigned:)
 * et priorité (priority:). Met aussi à jour la mémoire par expéditeur.
 *
 * POST { accountId?, limit? }
 *  → { ok, classified: [{ threadId, label, assigneeId, priority }] }
 */

const SYSTEM = `Tu es Auguste, assistant de tri de l'agence immobilière Lotier Immobilier.
Tu classes des emails entrants. Réponds UNIQUEMENT en JSON valide, sans texte autour.`;

const PRIORITIES = new Set(["haute", "normale", "basse"]);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { accountId, limit = 25 } = await req.json().catch(() => ({}));

    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    // Conversations entrantes récentes encore non classées (pas de label type:)
    const recent = await prisma.emailMessage.findMany({
      where: { folder: "INBOX", date: { gte: since }, ...(accountId ? { accountId } : {}) },
      orderBy: { date: "desc" },
      take: 200,
      select: { id: true, threadId: true, fromEmail: true, fromName: true, subject: true, bodyText: true, senderType: true, labels: true, date: true },
    });

    // Garde la dernière occurrence par thread, ignore corbeille + déjà classés
    const byThread = new Map<string, typeof recent[number]>();
    for (const m of recent) {
      const key = m.threadId || m.id;
      if (m.labels.includes("trash")) continue;
      if (m.labels.some(l => l.startsWith("type:"))) continue;
      if (!byThread.has(key)) byThread.set(key, m);
    }
    const todo = [...byThread.values()].slice(0, Math.min(limit, 40));

    if (todo.length === 0) return NextResponse.json({ ok: true, classified: [] });

    // Agents disponibles
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, roleId: true } });
    const usersStr = users.map(u => `${u.id}: ${u.prenom} ${u.nom} (${u.roleId ?? "agent"})`).join(", ");
    const userIds = new Set(users.map(u => u.id));

    // Mémoire des expéditeurs connus
    const emails = [...new Set(todo.map(m => m.fromEmail.toLowerCase()).filter(Boolean))];
    const memories = await prisma.mailLabelMemory.findMany({ where: { fromEmail: { in: emails } } });
    const memByEmail = new Map(memories.map(m => [m.fromEmail.toLowerCase(), m]));

    const list = todo.map((m, i) => {
      const mem = memByEmail.get(m.fromEmail.toLowerCase());
      const memHint = mem ? ` [déjà vu: ${mem.labelIds.join(",")}${mem.assignedToId ? ` → ${mem.assignedToId}` : ""}]` : "";
      return `#${i} De: ${m.fromName ?? m.fromEmail} <${m.fromEmail}> (${m.senderType ?? "inconnu"})${memHint}\nObjet: ${m.subject}\nExtrait: ${(m.bodyText || "").slice(0, 220).replace(/\s+/g, " ")}`;
    }).join("\n---\n");

    const prompt = `Classe chacun de ces ${todo.length} emails entrants.

Agents disponibles: ${usersStr}

Emails:
${list}

Réponds UNIQUEMENT par un tableau JSON, un objet par email, dans le même ordre (champ "i" = numéro #) :
[{"i":0,"label":"locataire|propriétaire|commercial|comptabilité|juridique|technique|autre","assigneeId":"id agent ou null","priority":"haute|normale|basse"}]

Règles de priorité :
- haute : urgence, impayé, litige, préavis/départ, sinistre, délai légal, mise en demeure
- basse : newsletter, publicité, accusé de réception, simple information sans action
- normale : tout le reste
Si un expéditeur est marqué « déjà vu », réutilise son classement sauf indication contraire dans le contenu.`;

    const arr = await augusteJson<Array<{ i: number; label?: string; assigneeId?: string | null; priority?: string }>>({
      model: MODELS.fast,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }, { fallback: [] });

    const classified: Array<{ threadId: string; label: string; assigneeId: string | null; priority: string }> = [];

    for (const r of Array.isArray(arr) ? arr : []) {
      const m = todo[r.i];
      if (!m) continue;
      const threadKey = m.threadId || m.id;

      const label = (r.label || "autre").toLowerCase();
      const priority = PRIORITIES.has((r.priority || "").toLowerCase()) ? (r.priority as string).toLowerCase() : "normale";
      const assigneeId = r.assigneeId && userIds.has(r.assigneeId) ? r.assigneeId : null;

      // Labels à poser (on retire d'abord les anciens type:/priority:)
      const newTags = [`type:${label}`, `priority:${priority}`];
      if (assigneeId) newTags.push(`assigned:${assigneeId}`);

      const rows = await prisma.emailMessage.findMany({ where: { threadId: threadKey }, select: { id: true, labels: true } });
      for (const row of rows) {
        const base = row.labels.filter(l => !l.startsWith("type:") && !l.startsWith("priority:"));
        // ne réassigne pas si déjà assigné manuellement
        const keepAssign = base.some(l => l.startsWith("assigned:"));
        const merged = [...new Set([...base, ...newTags.filter(t => keepAssign ? !t.startsWith("assigned:") : true)])];
        await prisma.emailMessage.update({ where: { id: row.id }, data: { labels: merged } });
      }

      // Mémorise pour cet expéditeur
      if (m.fromEmail) {
        const labelIds = [`type:${label}`];
        await prisma.mailLabelMemory.upsert({
          where: { fromEmail: m.fromEmail.toLowerCase() },
          create: { fromEmail: m.fromEmail.toLowerCase(), labelIds, assignedToId: assigneeId },
          update: { labelIds, ...(assigneeId ? { assignedToId: assigneeId } : {}) },
        }).catch(() => {});
      }

      classified.push({ threadId: threadKey, label, assigneeId, priority });
    }

    return NextResponse.json({ ok: true, classified });
  } catch (err) {
    const e = normalizeError(err);
    console.error("[mail/auto-classify] Erreur:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  }
}
