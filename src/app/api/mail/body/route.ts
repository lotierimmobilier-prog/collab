import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { accessibleMailAccount } from "@/lib/mailOwner";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { simpleParser } = require("mailparser");

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  let { host, port, ssl, username, password } = body;
  const { uid, accountId } = body;

  // Cloisonnement : pour une boîte gérée en base, l'utilisateur doit en être
  // agent. On complète alors les identifiants manquants depuis la base. Si
  // l'identifiant n'est PAS une boîte gérée (compte local) mais que le client
  // fournit les identifiants, on poursuit — comme pour la synchronisation.
  if (accountId) {
    const dbAcc = await accessibleMailAccount(session.user.id, accountId);
    if (dbAcc) {
      if (!host || !password) {
        host = dbAcc.host; port = String(dbAcc.port); ssl = dbAcc.ssl; username = dbAcc.username; password = dbAcc.password;
      }
    } else {
      // Boîte existante en base mais non autorisée → refus. Sinon (compte local
      // non géré en base) on poursuit avec les identifiants fournis par le client.
      const exists = await prisma.mailAccountConfig.findUnique({ where: { id: accountId }, select: { id: true } });
      if (exists) {
        return NextResponse.json({ ok: false, error: "Accès non autorisé à cette boîte" }, { status: 403 });
      }
    }
  }

  if (!host || !username || !password || !uid) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  const client = new ImapFlow({
    host,
    port: parseInt(port),
    secure: ssl,
    auth: { user: username, pass: password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Récupérer le message brut complet (RFC822)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await (client as any).download(`${uid}`, undefined, { uid: true });
      const chunks: Buffer[] = [];
      for await (const chunk of raw.content) chunks.push(chunk);
      const rawBuffer = Buffer.concat(chunks);

      // Parser avec mailparser — gère multipart, quoted-printable, base64, charsets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = await simpleParser(rawBuffer);

      // Remplacer les images CID inline par leur data URI base64
      let bodyHtml: string = parsed.html || "";
      const bodyText: string = parsed.text || "";

      if (parsed.attachments && bodyHtml) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const att of parsed.attachments as any[]) {
          if (att.contentId && att.content) {
            const cid = att.contentId.replace(/[<>]/g, "");
            const mime = att.contentType || "image/png";
            const b64  = att.content.toString("base64");
            const dataUri = `data:${mime};base64,${b64}`;
            // Remplacer cid:... par data URI
            bodyHtml = bodyHtml.replace(new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), dataUri);
          }
        }
      }

      // Nettoyer le HTML : retirer les scripts et styles dangereux
      bodyHtml = sanitizeHtml(bodyHtml);

      // Pièces jointes (hors images inline)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachments = (parsed.attachments as any[] || [])
        .filter((a: any) => a.contentDisposition !== "inline" || !a.contentId)
        .map((a: any) => ({
          id: a.checksum || a.filename,
          name: a.filename || "fichier",
          size: a.size || a.content?.length || 0,
          mime: a.contentType || "application/octet-stream",
          // Inclure le contenu en base64 pour permettre le téléchargement
          data: a.content?.toString("base64") ?? null,
        }));

      return NextResponse.json({ ok: true, bodyHtml, bodyText: bodyText.slice(0, 8000), attachments });
    } finally {
      lock.release();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ ok: false, error: msg });
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

// Retire scripts, iframes et event handlers inline pour éviter le XSS
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "data-blocked:");
}
