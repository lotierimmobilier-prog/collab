export type Protocol = "imap" | "pop3";
export type MailStatus = "unread" | "read" | "replied" | "forwarded" | "starred";

export interface MailAccount {
  id: string;
  label: string;
  email: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  smtpSsl: boolean;
  color: string;
  active: boolean;
  lastSync?: string;
  signature?: string;         // Signature HTML/texte personnalisée par compte
  // Accès multi-utilisateurs
  sharedUserIds?: string[];   // IDs des utilisateurs autorisés (vide = créateur seulement)
  isShared?: boolean;         // true si compte d'agence partagé
  canManage?: boolean;        // l'utilisateur courant peut-il gérer la config (super admin / sa boîte)
  dbId?: string;              // ID en base si persisté
}

export interface MailSentEntry {
  messageId: string;
  sentByUserId: string;
  sentByName: string;
  to: string;
  subject: string;
  date: string;
  accountId: string;
}

export interface MailLabel {
  id: string;
  name: string;
  color: string;
  system?: boolean;       // labels système : boite de réception, envoyé, etc.
}

export interface MailAttachment {
  id: string;
  name: string;
  size: number;
  mime?: string;
  type?: string;
  data?: string; // base64, pour téléchargement
}

export interface MailMessage {
  id: string;
  threadId: string;
  accountId: string;
  from: { name: string; email: string };
  to:   { name: string; email: string }[];
  cc?:  { name: string; email: string }[];
  subject: string;
  body: string;           // HTML ou texte
  bodyText: string;       // texte brut pour l'IA
  date: string;           // ISO
  status: MailStatus;
  labels: string[];       // label ids
  attachments?: MailAttachment[];
  inReplyTo?: string;     // message-id parent
}

export interface MailThread {
  id: string;
  subject: string;
  messages: MailMessage[];
  labels: string[];
  accountId: string;
  lastDate: string;
  participants: string[];
}

export const SYSTEM_LABELS: MailLabel[] = [
  { id: "inbox",   name: "Boite de réception", color: "#374151", system: true },
  { id: "sent",    name: "Envoyés",            color: "#374151", system: true },
  { id: "drafts",  name: "Brouillons",         color: "#374151", system: true },
  { id: "starred", name: "Suivis",             color: "#f59e0b", system: true },
  { id: "pub",     name: "Publicité",          color: "#9333ea", system: true },
  { id: "trash",   name: "Corbeille",          color: "#ef4444", system: true },
];

export const DEFAULT_LABELS: MailLabel[] = [
  ...SYSTEM_LABELS,
  { id: "locataires", name: "Locataires",  color: "#B8966A" },
  { id: "proprietaires", name: "Propriétaires", color: "#0891b2" },
  { id: "mandataires", name: "Mandataires", color: "#059669" },
  { id: "urgents",  name: "Urgents",       color: "#dc2626" },
  { id: "compta",   name: "Comptabilité",  color: "#d97706" },
];

export const IMAP_PRESETS: Record<string, { host: string; port: number; smtpHost: string; smtpPort: number }> = {
  "gmail.com":       { host: "imap.gmail.com",       port: 993, smtpHost: "smtp.gmail.com",       smtpPort: 465 },
  "outlook.com":     { host: "imap-mail.outlook.com", port: 993, smtpHost: "smtp-mail.outlook.com", smtpPort: 587 },
  "hotmail.com":     { host: "imap-mail.outlook.com", port: 993, smtpHost: "smtp-mail.outlook.com", smtpPort: 587 },
  "yahoo.fr":        { host: "imap.mail.yahoo.com",  port: 993, smtpHost: "smtp.mail.yahoo.com",  smtpPort: 465 },
  "orange.fr":       { host: "imap.orange.fr",       port: 993, smtpHost: "smtp.orange.fr",       smtpPort: 465 },
  "free.fr":         { host: "imap.free.fr",         port: 993, smtpHost: "smtp.free.fr",         smtpPort: 465 },
  "laposte.net":     { host: "imap.laposte.net",     port: 993, smtpHost: "smtp.laposte.net",     smtpPort: 465 },
  "sfr.fr":          { host: "imap.sfr.fr",          port: 993, smtpHost: "smtp.sfr.fr",          smtpPort: 465 },
};

export const ACCOUNT_COLORS = ["#B8966A","#0891b2","#059669","#dc2626","#d97706","#db2777","#374151"];

export function getPreset(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? IMAP_PRESETS[domain] : undefined;
}

// Signature de contenu d'un message : sert à dédoublonner les copies d'un même
// email (re-synchronisé avec un uid différent → plusieurs lignes en base).
function messageSignature(m: MailMessage): string {
  const inReply = (m as { messageId?: string }).messageId;
  if (inReply) return `mid:${inReply}`;
  return `${m.from.email}|${new Date(m.date).getTime()}|${(m.subject || "").trim()}|${(m.bodyText || "").slice(0, 80)}`;
}

export function dedupeMessages(messages: MailMessage[]): MailMessage[] {
  const seen = new Set<string>();
  const out: MailMessage[] = [];
  for (const m of messages) {
    const sig = messageSignature(m);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(m);
  }
  return out;
}

export function threadFromMessages(messages: MailMessage[]): MailThread {
  const sorted = dedupeMessages([...messages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  const participants = [...new Set(sorted.flatMap(m => [m.from.email, ...m.to.map(t => t.email)]))];
  return {
    id: sorted[0]?.threadId ?? "",
    subject: sorted[0]?.subject ?? "",
    messages: sorted,
    labels: [...new Set(sorted.flatMap(m => m.labels))],
    accountId: sorted[0]?.accountId ?? "",
    lastDate: sorted[sorted.length - 1]?.date ?? "",
    participants,
  };
}

export function buildContext(thread: MailThread): string {
  return thread.messages
    .map(m => `De: ${m.from.name} <${m.from.email}>\nDate: ${new Date(m.date).toLocaleString("fr-FR")}\n\n${m.bodyText}`)
    .join("\n\n---\n\n");
}
