import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

// Noms courants du dossier Envoyés selon les serveurs IMAP.
const SENT_FOLDERS = ["Sent", "Sent Messages", "Sent Items", "SENT", "Éléments envoyés", "Envoyés"];

/**
 * Supprime DÉFINITIVEMENT un message sur le serveur IMAP (marque \Deleted puis
 * expunge), pour que la prochaine synchronisation ne le ré-importe pas. Best
 * effort : toute erreur (POP3, droits, dossier introuvable) est ignorée — la
 * suppression locale (tombstone) reste la garantie principale anti-résurrection.
 *
 * @returns true si le message a bien été supprimé côté serveur.
 */
export async function deleteFromImapServer(accountId: string, uid: string, folder: string): Promise<boolean> {
  const acc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId } }).catch(() => null);
  if (!acc || (acc.protocol && acc.protocol.toLowerCase() === "pop3")) return false;
  // Le dossier est stocké normalisé ("INBOX" / "SENT"). Pour les envoyés, on
  // essaie les noms usuels jusqu'à en trouver un valide.
  const candidates = folder === "SENT" ? SENT_FOLDERS : ["INBOX"];

  const client = new ImapFlow({
    host: acc.host, port: acc.port, secure: acc.ssl,
    auth: { user: acc.username, pass: acc.password },
    logger: false, connectionTimeout: 20000, greetingTimeout: 8000, socketTimeout: 30000,
  });
  try {
    await client.connect();
    for (const mailbox of candidates) {
      try {
        const lock = await client.getMailboxLock(mailbox);
        try {
          // messageDelete marque \Deleted ET expunge (suppression réelle).
          const ok = await client.messageDelete(String(uid), { uid: true });
          if (ok) return true;
        } finally { lock.release(); }
      } catch { /* dossier suivant */ }
    }
    return false;
  } catch {
    return false;
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
