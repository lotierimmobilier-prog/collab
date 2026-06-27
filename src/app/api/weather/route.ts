import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Météo : Météo-Concept (France, données fines) si un token est configuré
// (METEO_CONCEPT_TOKEN), sinon Open-Meteo (gratuit, mondial, sans clé).
// Renvoie temps actuel + prévisions 7 jours + courbe horaire. Cache 30 min/ville.
interface WeatherPayload {
  city: string; region: string | null; timezone: string | null; time: string | null;
  current: { temp: number; code: number; wind: number; isDay: boolean };
  daily: { date: string; code: number; tmin: number; tmax: number }[];
  hourly: { time: string; temp: number; code: number }[];
}
const cache = new Map<string, { at: number; data: WeatherPayload }>();
const TTL = 30 * 60_000;

// ─────────────────────── Open-Meteo (par défaut) ───────────────────────
async function omGeocode(city: string): Promise<{ name: string; region: string | null; lat: number; lon: number } | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d?.results?.[0];
  if (!hit) return null;
  return { name: hit.name, region: hit.admin1 ?? hit.country ?? null, lat: hit.latitude, lon: hit.longitude };
}

async function omForecast(lat: number, lon: number) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,weather_code,wind_speed_10m,is_day`
    + `&hourly=temperature_2m,weather_code`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min`
    + `&forecast_days=7&timezone=auto`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  if (!d?.current || !d?.daily) return null;
  const daily = (d.daily.time ?? []).map((date: string, i: number) => ({
    date, code: d.daily.weather_code?.[i] ?? 0,
    tmax: Math.round(d.daily.temperature_2m_max?.[i] ?? 0),
    tmin: Math.round(d.daily.temperature_2m_min?.[i] ?? 0),
  }));
  const times: string[] = d.hourly?.time ?? [];
  const nowTime = String(d.current.time ?? "");
  let s = times.findIndex(t => t >= nowTime); if (s < 0) s = 0;
  const hourly = times.slice(s, s + 24).map((time, k) => ({ time, temp: Math.round(d.hourly.temperature_2m?.[s + k] ?? 0), code: d.hourly.weather_code?.[s + k] ?? 0 }));
  return {
    timezone: d.timezone ?? null, time: d.current.time ?? null,
    current: { temp: Math.round(d.current.temperature_2m ?? 0), code: d.current.weather_code ?? 0, wind: Math.round(d.current.wind_speed_10m ?? 0), isDay: d.current.is_day !== 0 },
    daily, hourly,
  };
}

async function viaOpenMeteo(city: string): Promise<{ data?: WeatherPayload; status?: number; error?: string }> {
  const geo = await omGeocode(city);
  if (!geo) return { status: 404, error: "Ville introuvable" };
  const fc = await omForecast(geo.lat, geo.lon);
  if (!fc) return { status: 502, error: "Météo indisponible" };
  return { data: { city: geo.name, region: geo.region, ...fc } };
}

// ─────────────────────── Météo-Concept (si token) ───────────────────────
const MC_BASE = "https://api.meteo-concept.com/api";

// Codes météo Météo-Concept → équivalent WMO (réutilise les icônes existantes).
function mcToWmo(c: number): number {
  if (c === 0) return 0;
  if (c === 1) return 1;
  if (c === 2 || c === 3) return 2;
  if (c === 4 || c === 5) return 3;
  if (c === 6) return 45;
  if (c === 7) return 48;
  if (c === 16) return 51;                          // bruine
  if (c >= 10 && c <= 12) return 61 + (c - 10) * 2; // pluie faible/modérée/forte
  if (c >= 13 && c <= 15) return 66;                // pluie verglaçante
  if (c >= 20 && c <= 22) return 71 + (c - 20) * 2; // neige faible/modérée/forte
  if (c >= 30 && c <= 32) return 66;                // pluie et neige mêlées
  if (c >= 40 && c <= 46) return 80 + Math.min(2, c - 40); // averses de pluie
  if (c >= 60 && c <= 78) return 85;                // averses de neige / mêlées
  if ((c >= 100 && c <= 142) || (c >= 210 && c <= 235)) return 95; // orages
  return 3;
}

async function mcGeocode(city: string, token: string): Promise<{ insee: string; name: string; region: string | null } | null> {
  const r = await fetch(`${MC_BASE}/location/city?token=${token}&search=${encodeURIComponent(city)}`);
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d?.cities?.[0];
  if (!hit) return null;
  return { insee: String(hit.insee), name: hit.name ?? city, region: hit.departement ?? hit.dept ?? null };
}

async function mcForecast(insee: string, token: string) {
  const [dailyR, hoursR] = await Promise.all([
    fetch(`${MC_BASE}/forecast/daily?token=${token}&insee=${insee}`),
    fetch(`${MC_BASE}/forecast/nextHours?token=${token}&insee=${insee}`).catch(() => null),
  ]);
  if (!dailyR.ok) return null;
  const dd = await dailyR.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc: any[] = dd?.forecast ?? [];
  if (!fc.length) return null;
  const daily = fc.slice(0, 7).map(f => ({ date: String(f.datetime).slice(0, 10), code: mcToWmo(f.weather), tmin: Math.round(f.tmin), tmax: Math.round(f.tmax) }));

  let current: WeatherPayload["current"] | null = null;
  let hourly: WeatherPayload["hourly"] = [];
  let time: string | null = null;
  if (hoursR && hoursR.ok) {
    const hd = await hoursR.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hf: any[] = hd?.forecast ?? [];
    if (hf.length) {
      const c0 = hf[0];
      time = c0.datetime ?? null;
      current = { temp: Math.round(c0.temp2m ?? c0.temp ?? 0), code: mcToWmo(c0.weather), wind: Math.round(c0.wind10m ?? 0), isDay: true };
      hourly = hf.slice(0, 24).map(h => ({ time: h.datetime, temp: Math.round(h.temp2m ?? 0), code: mcToWmo(h.weather) }));
    }
  }
  if (!current) current = { temp: Math.round(fc[0].tmax), code: mcToWmo(fc[0].weather), wind: 0, isDay: true };
  return { timezone: "Europe/Paris", time, current, daily, hourly };
}

async function viaMeteoConcept(city: string, token: string): Promise<{ data?: WeatherPayload; status?: number; error?: string }> {
  const geo = await mcGeocode(city, token);
  if (!geo) return { status: 404, error: "Ville introuvable (Météo-Concept)" };
  const fc = await mcForecast(geo.insee, token);
  if (!fc) return { status: 502, error: "Météo indisponible (Météo-Concept)" };
  return { data: { city: geo.name, region: geo.region, ...fc } };
}

// ─────────────────────────────── Handler ───────────────────────────────
// GET /api/weather[?city=] — météo de la ville du profil (ou ?city= en aperçu).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let city = (new URL(req.url).searchParams.get("city") || "").trim();
  if (!city) {
    try {
      const { getExtra } = await import("@/lib/user-extras");
      const ex = await getExtra(session.user.id);
      city = (ex?.city || "").trim();
    } catch { /* table absente */ }
  }
  if (!city) return NextResponse.json({ city: null, needsCity: true });

  const key = city.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const token = (process.env.METEO_CONCEPT_TOKEN || "").trim();
  try {
    // Météo-Concept en priorité si un token est configuré, repli Open-Meteo.
    let res = token ? await viaMeteoConcept(city, token) : { error: "no-token" };
    if (!res.data) res = await viaOpenMeteo(city);
    if (!res.data) return NextResponse.json({ city, error: res.error ?? "Météo indisponible" }, { status: res.status ?? 502 });
    cache.set(key, { at: Date.now(), data: res.data });
    return NextResponse.json(res.data);
  } catch (e) {
    return NextResponse.json({ city, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
