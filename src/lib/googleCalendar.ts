/* Google Calendar API v3 — OAuth 2.0 with PKCE */

export interface GCalConfig {
  clientId: string;
  apiKey?: string;
}

export interface GCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  selected: boolean;
  primary?: boolean;
}

export interface GEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  htmlLink?: string;
  status?: string;
  organizer?: { displayName?: string; email?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
}

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

/* ─── Clés préfixées par userId pour isoler les données par utilisateur ─── */
function key(base: string, userId?: string) {
  return userId ? `${base}_${userId}` : base;
}

/* ─── Token storage ─────────────────────────────────────────── */
export function saveToken(token: google.accounts.oauth2.TokenResponse, userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key("collab_gtoken", userId), JSON.stringify({ ...token, _saved: Date.now() }));
}

export function loadToken(userId?: string): (google.accounts.oauth2.TokenResponse & { _saved?: number }) | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key("collab_gtoken", userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearToken(userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key("collab_gtoken", userId));
}

export function isTokenValid(token: { expires_in: string; _saved?: number } | null): boolean {
  if (!token) return false;
  const saved = token._saved ?? 0;
  const expiresIn = parseInt(token.expires_in ?? "3600", 10) * 1000;
  return Date.now() - saved < expiresIn - 60_000;
}

/* ─── Config storage ─────────────────────────────────────────── */
export function saveConfig(config: GCalConfig, userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key("collab_gcal_config", userId), JSON.stringify(config));
}
export function loadConfig(userId?: string): GCalConfig | null {
  const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (envClientId) return { clientId: envClientId };
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key("collab_gcal_config", userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ─── Agendas sélectionnés ───────────────────────────────────── */
export function saveSelectedCalendars(ids: string[], userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key("collab_gcal_selected", userId), JSON.stringify(ids));
}
export function loadSelectedCalendars(userId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key("collab_gcal_selected", userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/* ─── Cache de la liste complète des agendas ─────────────────── */
export function saveCalendarList(cals: GCalendar[], userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key("collab_gcal_list", userId), JSON.stringify(cals));
}
export function loadCalendarList(userId?: string): GCalendar[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key("collab_gcal_list", userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function clearCalendarList(userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key("collab_gcal_list", userId));
}

/* ─── Google API helpers ─────────────────────────────────────── */
type WindowWithGsi = Window & {
  google?: typeof google;
};

export async function loadGapiAndGis(): Promise<void> {
  const w = window as WindowWithGsi;
  if (w.google) return; // GIS déjà chargé

  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Impossible de charger Google Sign-In. Vérifiez votre connexion."));
    document.head.appendChild(s);
  });
}

export async function requestToken(clientId: string): Promise<google.accounts.oauth2.TokenResponse> {
  return new Promise((res, rej) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) return rej(new Error(resp.error));
        res(resp);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export async function fetchCalendars(accessToken: string): Promise<GCalendar[]> {
  const resp = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error("Impossible de charger les agendas");
  const data = await resp.json();
  const saved = loadSelectedCalendars();
  return (data.items ?? []).map((c: GCalendar) => ({
    ...c,
    selected: saved.includes(c.id) || c.primary === true,
  }));
}

export async function fetchEvents(
  calendarId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<GEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "200");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.items ?? []).map((e: GEvent) => ({ ...e, calendarId }));
}
