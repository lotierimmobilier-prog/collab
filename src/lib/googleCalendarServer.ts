// Google Agenda — connexion serveur permanente (OAuth 2.0 « offline »).
// Le refresh_token est stocké chiffré ; l'access_token est rafraîchi
// automatiquement, donc l'agenda reste disponible sans reconnexion (y compris
// côté serveur pour Auguste et le tableau de bord).
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/ics-crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const SCOPES = `openid email ${CAL_SCOPE}`;

export interface GCal { id: string; summary: string; backgroundColor?: string; primary?: boolean }
export interface GEv {
  id: string; calendarId: string; summary: string; description?: string; location?: string;
  start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string };
  htmlLink?: string; backgroundColor?: string;
}

export function googleClientId(): string { return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ""; }
export function googleClientSecret(): string { return process.env.GOOGLE_CLIENT_SECRET || ""; }
export function googleConfigured(): boolean { return !!googleClientId() && !!googleClientSecret(); }
function baseUrl(): string { return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://collab.lotier-immobilier.com").replace(/\/$/, ""); }
export function redirectUri(): string { return `${baseUrl()}/api/google/calendar/callback`; }

// ── État signé (HMAC) pour relier le retour OAuth à l'utilisateur ──
function stateSecret(): string { return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "collab"; }
export function signState(userId: string): string {
  const ts = Date.now().toString(36);
  const payload = `${userId}.${ts}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 24);
  return `${payload}.${sig}`;
}
export function verifyState(state: string): string | null {
  const parts = (state || "").split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = crypto.createHmac("sha256", stateSecret()).update(`${userId}.${ts}`).digest("hex").slice(0, 24);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  // Expiration de l'état : 15 minutes.
  if (Date.now() - parseInt(ts, 36) > 15 * 60_000) return null;
  return userId;
}

export function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // force la délivrance d'un refresh_token
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

// ── Échange du code d'autorisation contre des jetons ──
export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const body = new URLSearchParams({
    code, client_id: googleClientId(), client_secret: googleClientSecret(),
    redirect_uri: redirectUri(), grant_type: "authorization_code",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`Échange OAuth Google échoué (${r.status})`);
  return r.json();
}

async function refreshAccess(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    refresh_token: refreshToken, client_id: googleClientId(), client_secret: googleClientSecret(), grant_type: "refresh_token",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`Rafraîchissement du jeton Google échoué (${r.status})`);
  return r.json();
}

export async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.email ?? null;
  } catch { return null; }
}

export async function fetchCalendarList(accessToken: string): Promise<GCal[]> {
  const r = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error("Impossible de charger la liste des agendas");
  const d = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (d.items ?? []).map((c: any) => ({ id: c.id, summary: c.summary, backgroundColor: c.backgroundColor, primary: !!c.primary }));
}

export async function fetchEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<GEv[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return [];
  const d = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (d.items ?? []).map((e: any) => ({
    id: e.id, calendarId, summary: e.summary ?? "(Sans titre)", description: e.description, location: e.location,
    start: e.start ?? {}, end: e.end ?? {}, htmlLink: e.htmlLink,
  }));
}

// ── Accès/maj du compte stocké ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAccount(userId: string): Promise<any | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma.googleCalendarAccount.findUnique as any)({ where: { userId } }).catch(() => null);
}

// Renvoie un access_token valide (cache + rafraîchissement automatique).
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const acc = await getAccount(userId);
  if (!acc) return null;
  if (acc.accessToken && acc.accessExpiry && new Date(acc.accessExpiry).getTime() - Date.now() > 60_000) {
    const cached = decryptSecret(acc.accessToken);
    if (cached) return cached;
  }
  const rt = decryptSecret(acc.refreshToken);
  if (!rt) return null;
  try {
    const t = await refreshAccess(rt);
    const exp = new Date(Date.now() + (t.expires_in - 60) * 1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.googleCalendarAccount.update as any)({ where: { userId }, data: { accessToken: encryptSecret(t.access_token), accessExpiry: exp } });
    return t.access_token;
  } catch { return null; }
}

export interface MergedEvent {
  id: string; title: string; start: string; end: string; color: string;
  description?: string; location?: string; htmlLink?: string; source: "google"; calendarId: string;
}

// Événements Google de l'utilisateur sur une fenêtre — pour fusion serveur.
export async function getGoogleEvents(userId: string, timeMin: string, timeMax: string): Promise<MergedEvent[]> {
  const acc = await getAccount(userId);
  if (!acc) return [];
  const selected: string[] = Array.isArray(acc.selected) ? acc.selected : [];
  if (!selected.length) return [];
  const token = await getValidAccessToken(userId);
  if (!token) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colorByCal = new Map<string, string>((Array.isArray(acc.calendars) ? acc.calendars : []).map((c: any) => [c.id, c.backgroundColor || "#4285F4"]));
  const out: MergedEvent[] = [];
  await Promise.all(selected.map(async calId => {
    const evts = await fetchEvents(token, calId, timeMin, timeMax).catch(() => []);
    for (const e of evts) {
      const start = e.start.dateTime ?? e.start.date ?? "";
      const end = e.end.dateTime ?? e.end.date ?? start;
      if (!start) continue;
      out.push({
        id: `g-${calId}-${e.id}`, title: e.summary, start, end,
        color: colorByCal.get(calId) || "#4285F4",
        description: e.description, location: e.location, htmlLink: e.htmlLink,
        source: "google", calendarId: calId,
      });
    }
  }));
  return out;
}

export async function getStatus(userId: string): Promise<{ connected: boolean; email: string | null; calendars: GCal[]; selected: string[] }> {
  const acc = await getAccount(userId);
  if (!acc) return { connected: false, email: null, calendars: [], selected: [] };
  return {
    connected: true,
    email: acc.googleEmail ?? null,
    calendars: Array.isArray(acc.calendars) ? acc.calendars : [],
    selected: Array.isArray(acc.selected) ? acc.selected : [],
  };
}
