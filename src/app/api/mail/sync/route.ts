import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveAccountOwner, accessibleMailAccount } from "@/lib/mailOwner";
import { detectPortal } from "@/lib/portalLeads";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

const PAGE_SIZE   = 30;
const MONTHS_BACK = 6;

// Noms courants du dossier Envoyés sur les serveurs IMAP
const SENT_FOLDERS = ["Sent", "Sent Messages", "Sent Items", "SENT", "Éléments envoyés", "Envoyés"];

function makeClient(host: string, port: string, ssl: boolean, username: string, password: string) {
  return new ImapFlow({
    host, port: parseInt(port), secure: ssl,
    auth: { user: username, pass: password },
    logger: false, connectionTimeout: 20000, greetingTimeout: 8000, socketTimeout: 30000,
  });
}

async function identifySender(email: string): Promise<{ senderType: string; senderId?: string }> {
  if (!email) return { senderType: "unknown" };
  const [user, owner, tenant] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.owner.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.tenant.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
  ]);
  if (user)   return { senderType: "user",   senderId: user.id };
  if (owner)  return { senderType: "owner",  senderId: owner.id };
  if (tenant) return { senderType: "tenant", senderId: tenant.id };
  return { senderType: "unknown" };
}

// Synchronise un dossier IMAP donné, page par page
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncFolder(client: any, folder: string, accountId: string, since: Date, page: number, ownerId: string) {
  const messages: Array<Record<string, unknown>> = [];
  let total = 0;
  let totalPages = 0;

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchedUids: number[] = await (client as any).search({ since }, { uid: true });
      matchedUids.sort((a, b) => b - a);
      total      = matchedUids.length;
      totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
      const pageUids = matchedUids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

      if (pageUids.length > 0) {
        const isSent = folder !== "INBOX";
        // Dossier stocké normalisé (l'IMAP peut nommer les Envoyés différemment)
        const sFolder = isSent ? "SENT" : "INBOX";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const msg of (client as any).fetch(pageUids.join(","), { uid: true, flags: true, envelope: true, headers: ["list-unsubscribe", "precedence"] }, { uid: true }) as AsyncIterable<any>) {
          const env       = msg.envelope ?? {};
          const flags     = msg.flags ?? new Set();
          const isUnread  = !flags.has("\\Seen");
          const isStarred = flags.has("\\Flagged");
          const fromEmail = env.from?.[0]?.address ?? "";
          const msgDate   = env.date ? new Date(env.date) : new Date();
          if (msgDate < since) continue;

          const threadId = env.messageId
            ? env.messageId.replace(/[<>]/g, "").replace(/[^a-zA-Z0-9@._-]/g, "_")
            : `${accountId}-${sFolder}-${msg.uid}`;

          // Détection newsletter / publicité : en-tête List-Unsubscribe (signal
          // standard) ou Precedence: bulk, ou mots-clés dans l'objet/expéditeur.
          // EXCEPTION : les mails des portails (Leboncoin, Bien'ici, Le Figaro)
          // sont des leads commerciaux → ils restent en boîte de réception même
          // s'ils portent les marqueurs habituels des newsletters.
          const hdrs    = (msg.headers ? msg.headers.toString() : "").toLowerCase();
          const subjLc  = (env.subject ?? "").toLowerCase();
          const fromLc  = fromEmail.toLowerCase();
          const isPortal = !!detectPortal(fromEmail);
          const isPub   = !isSent && !isPortal && (
            hdrs.includes("list-unsubscribe") ||
            hdrs.includes("precedence: bulk") ||
            /désinscri|desinscri|se d[ée]sabonner|unsubscribe|newsletter|no[-_]?reply|nepasrepondre|ne-pas-repondre/.test(`${subjLc} ${fromLc}`)
          );

          // Anti-résurrection : si ce message (identifié par son Message-ID
          // stable) a déjà été supprimé/mis en corbeille, on ne le ré-importe
          // pas — même si le serveur lui a attribué un nouveau UID.
          const cleanMid = env.messageId?.replace(/[<>]/g, "");
          if (cleanMid) {
            const tomb = await prisma.emailMessage.findFirst({
              where: { accountId, messageId: cleanMid, labels: { hasSome: ["deleted", "trash"] } },
              select: { id: true },
            }).catch(() => null);
            if (tomb) continue;
            // Correction : un mail de portail déjà rangé en « pub » par erreur
            // est remis en boîte de réception (en conservant ses autres tags).
            if (isPortal) {
              const ex = await prisma.emailMessage.findFirst({ where: { accountId, messageId: cleanMid, labels: { has: "pub" } }, select: { id: true, labels: true } }).catch(() => null);
              if (ex) {
                const fixed = ex.labels.filter(l => l !== "pub");
                if (!fixed.includes("inbox")) fixed.push("inbox");
                await prisma.emailMessage.update({ where: { id: ex.id }, data: { labels: fixed } }).catch(() => {});
              }
            }
          }

          const identity = await identifySender(fromEmail);
          const labels   = isSent ? ["sent"] : isPub ? ["pub"] : ["inbox", ...(isStarred ? ["starred"] : [])];

          messages.push({
            id: `${accountId}-${sFolder}-${msg.uid}`,
            uid: msg.uid, threadId, accountId, folder: sFolder,
            from: { name: env.from?.[0]?.name ?? fromEmail, email: fromEmail },
            to: (env.to ?? []).map((a: { name?: string; address?: string }) => ({ name: a.name ?? a.address ?? "", email: a.address ?? "" })),
            subject: env.subject ?? "(Sans objet)",
            body: "", bodyText: "",
            date: msgDate.toISOString(),
            status: isUnread ? "unread" : "read",
            labels,
            senderType: identity.senderType,
            senderId: identity.senderId,
          });

          try {
            await prisma.emailMessage.upsert({
              where: { uid_accountId_folder: { uid: String(msg.uid), accountId, folder: sFolder } },
              create: {
                uid: String(msg.uid),
                messageId: env.messageId?.replace(/[<>]/g, ""),
                folder: sFolder, accountId, fromEmail,
                fromName: env.from?.[0]?.name,
                toEmail: (env.to ?? []).map((a: { address?: string }) => a.address).filter(Boolean).join(", "),
                subject: env.subject ?? "(Sans objet)",
                date: msgDate, read: !isUnread, starred: isStarred,
                threadId, labels,
                senderType: identity.senderType,
                senderId: identity.senderId,
                ownerId,
              },
              update: { read: !isUnread, starred: isStarred, senderType: identity.senderType, senderId: identity.senderId, ownerId },
            });
          } catch { /* ignore contrainte unique */ }
        }
      }
    } finally {
      lock.release();
    }
  } catch {
    // Dossier inexistant ou inaccessible — on ignore silencieusement
  }

  return { messages, total, totalPages };
}

// Détecte le vrai nom du dossier Envoyés sur ce serveur
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detectSentFolder(client: any): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tree = await (client as any).listTree();
    const allFolders: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walk(node: any) {
      if (node.name) allFolders.push(node.name);
      if (node.folders) node.folders.forEach(walk);
    }
    if (tree.folders) tree.folders.forEach(walk);

    for (const candidate of SENT_FOLDERS) {
      if (allFolders.some(f => f.toLowerCase() === candidate.toLowerCase())) return candidate;
    }
    // Cherche par attribut \Sent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = await (client as any).list();
    const sentBox = list.find((b: { specialUse?: string }) => b.specialUse === "\\Sent");
    if (sentBox) return sentBox.name;
  } catch { /* ignore */ }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  let { host, port, ssl, username, password } = body;
  const { accountId, page = 1, syncSent = true } = body;

  // Cloisonnement : pour toute boîte gérée en base, l'utilisateur doit en être
  // agent. Sans ce contrôle, on pouvait passer l'identifiant de la boîte d'un
  // collègue et en synchroniser/lire tout le courrier.
  if (accountId) {
    const dbAcc = await accessibleMailAccount(session.user.id, accountId);
    if (dbAcc) {
      // Boîte gérée et autorisée : on complète les identifiants manquants depuis
      // la base.
      if (!host || !password) {
        host = dbAcc.host; port = String(dbAcc.port); ssl = dbAcc.ssl; username = dbAcc.username; password = dbAcc.password;
      }
    } else {
      // Boîte EXISTANTE en base mais dont l'utilisateur n'est pas agent →
      // refus (cloisonnement : on ne synchronise pas le courrier d'un collègue).
      const exists = await prisma.mailAccountConfig.findUnique({ where: { id: accountId }, select: { id: true } });
      if (exists) {
        return NextResponse.json({ ok: false, error: "Accès non autorisé à cette boîte" }, { status: 403 });
      }
      // Sinon (identifiant non géré en base / compte local) : on poursuit avec
      // les identifiants fournis par le client — déjà validés par « Tester ».
    }
  }

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  // Le contenu synchronisé est rattaché à l'agent de la boîte (cloisonnement) ;
  // pour un compte local non géré en base, à l'utilisateur courant.
  const ownerId = (accountId ? await resolveAccountOwner(accountId) : null) ?? session.user.id;

  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_BACK);

  const client = makeClient(host, port, ssl, username, password);

  try {
    await client.connect();

    // Sync INBOX
    const inbox = await syncFolder(client, "INBOX", accountId, since, page, ownerId);

    // Sync Envoyés — historique complet (6 mois) lors de la synchro page 1
    let sentCount = 0;
    if (syncSent && page === 1) {
      const sentFolder = await detectSentFolder(client);
      if (sentFolder) {
        const first = await syncFolder(client, sentFolder, accountId, since, 1, ownerId);
        sentCount = first.messages.length;
        for (let p = 2; p <= first.totalPages; p++) {
          const more = await syncFolder(client, sentFolder, accountId, since, p, ownerId);
          sentCount += more.messages.length;
        }
      }
    }

    await client.logout();

    const total      = await prisma.emailMessage.count({ where: { accountId, folder: "INBOX", date: { gte: since } } });
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

    return NextResponse.json({
      ok: true,
      messages: inbox.messages,
      count: inbox.messages.length,
      sentCount,
      total,
      totalPages,
      page,
      since: since.toISOString(),
      message: `${inbox.messages.length} reçus${sentCount ? `, ${sentCount} envoyés` : ""} — page ${page}/${totalPages}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
