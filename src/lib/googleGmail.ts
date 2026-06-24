/* Gmail API via Google Identity Services (OAuth 2.0 côté navigateur) */

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

const TOKEN_KEY = "collab_gmail_token";
const CONFIG_KEY = "collab_gmail_config";

export interface GmailConfig {
  clientId: string;
  accountId: string;
  email: string;
  name: string;
}

export interface GmailTokenStore {
  access_token: string;
  expires_in: string;
  _saved: number;
  accountId: string;
}

/* ── Storage ───────────────────────────────────────────────── */
export function saveGmailToken(accountId: string, token: google.accounts.oauth2.TokenResponse) {
  if (typeof window === "undefined") return;
  const all = loadAllGmailTokens();
  all[accountId] = { ...token, _saved: Date.now(), accountId };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(all));
}

export function loadAllGmailTokens(): Record<string, GmailTokenStore> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "{}"); } catch { return {}; }
}

export function loadGmailToken(accountId: string): GmailTokenStore | null {
  return loadAllGmailTokens()[accountId] ?? null;
}

export function clearGmailToken(accountId: string) {
  if (typeof window === "undefined") return;
  const all = loadAllGmailTokens();
  delete all[accountId];
  localStorage.setItem(TOKEN_KEY, JSON.stringify(all));
}

export function isGmailTokenValid(token: GmailTokenStore | null): boolean {
  if (!token) return false;
  const expiresIn = parseInt(token.expires_in ?? "3600", 10) * 1000;
  return Date.now() - token._saved < expiresIn - 60_000;
}

export function saveGmailConfigs(configs: GmailConfig[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configs));
}

export function loadGmailConfigs(): GmailConfig[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "[]"); } catch { return []; }
}

/* ── Google Identity Services ──────────────────────────────── */
export async function loadGIS(): Promise<void> {
  if (typeof window === "undefined") return;
  if ((window as unknown as { google?: unknown }).google) return;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Impossible de charger Google Identity Services"));
    document.head.appendChild(s);
  });
}

export async function requestGmailToken(clientId: string): Promise<google.accounts.oauth2.TokenResponse> {
  await loadGIS();
  return new Promise((res, rej) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if ((resp as { error?: string }).error) return rej(new Error((resp as { error: string }).error));
        res(resp);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

/* ── Gmail REST API ────────────────────────────────────────── */
const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(path: string, token: string, options?: RequestInit) {
  const resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gmail API ${resp.status}`);
  }
  return resp.json();
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export async function fetchGmailProfile(token: string): Promise<GmailProfile> {
  return gmailFetch("/profile", token);
}

export interface RawGmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType: string;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }>;
  };
  internalDate: string;
}

function decodeBase64(data: string): string {
  try {
    return decodeURIComponent(
      atob(data.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch { return ""; }
}

function extractBody(payload: RawGmailMessage["payload"]): { text: string; html: string } {
  let text = "";
  let html = "";

  function walk(part: { mimeType: string; body?: { data?: string }; parts?: unknown[] }) {
    if (part.mimeType === "text/plain" && part.body?.data) text = decodeBase64(part.body.data);
    if (part.mimeType === "text/html" && part.body?.data) html = decodeBase64(part.body.data);
    if (part.parts) (part.parts as typeof part[]).forEach(walk);
  }
  walk(payload as { mimeType: string; body?: { data?: string }; parts?: unknown[] });
  if (!text && !html && payload.body?.data) {
    text = decodeBase64(payload.body.data);
    html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;
  }
  if (!html && text) html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;
  return { text: text.slice(0, 3000), html };
}

function header(msg: RawGmailMessage, name: string): string {
  return msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseAddress(raw: string): { name: string; email: string } {
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  return { name: raw, email: raw };
}

export interface FetchedMessage {
  id: string; threadId: string; accountId: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  subject: string; body: string; bodyText: string;
  date: string; status: "unread" | "read"; labels: string[];
}

export async function fetchGmailMessages(token: string, accountId: string, maxResults = 50): Promise<FetchedMessage[]> {
  // 1. Fetch list
  const list = await gmailFetch(`/messages?maxResults=${maxResults}&labelIds=INBOX`, token);
  if (!list.messages?.length) return [];

  // 2. Fetch each message in batch (sequential for simplicity)
  const msgs = await Promise.all(
    (list.messages as { id: string }[]).slice(0, maxResults).map(async ({ id }) => {
      try {
        const msg: RawGmailMessage = await gmailFetch(`/messages/${id}?format=full`, token);
        const from = parseAddress(header(msg, "From"));
        const toRaw = header(msg, "To");
        const to = toRaw.split(",").map(a => parseAddress(a.trim()));
        const subject = header(msg, "Subject") || "(Sans objet)";
        const date = new Date(parseInt(msg.internalDate)).toISOString();
        const { text, html } = extractBody(msg.payload);

        const labels: string[] = [];
        if (msg.labelIds.includes("INBOX")) labels.push("inbox");
        if (msg.labelIds.includes("STARRED")) labels.push("starred");
        if (msg.labelIds.includes("SENT")) labels.push("sent");
        if (msg.labelIds.includes("DRAFT")) labels.push("drafts");
        if (msg.labelIds.includes("TRASH")) labels.push("trash");
        if (!labels.length) labels.push("inbox");

        return {
          id: `gmail-${accountId}-${msg.id}`,
          threadId: `gmail-${accountId}-${msg.threadId}`,
          accountId,
          from,
          to,
          subject,
          body: html || `<p>${msg.snippet}</p>`,
          bodyText: text || msg.snippet,
          date,
          status: msg.labelIds.includes("UNREAD") ? "unread" as const : "read" as const,
          labels,
        };
      } catch { return null; }
    })
  );

  return msgs.filter(Boolean) as ReturnType<typeof fetchGmailMessages> extends Promise<infer T> ? T : never;
}
