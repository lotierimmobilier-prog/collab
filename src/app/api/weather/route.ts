import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Météo via Open-Meteo (gratuit, sans clé) : géocodage + temps actuel,
// prévisions sur 7 jours et courbe horaire. Cache mémoire 30 min/ville.
interface WeatherPayload {
  city: string; region: string | null; timezone: string | null; time: string | null;
  current: { temp: number; code: number; wind: number; isDay: boolean };
  daily: { date: string; code: number; tmin: number; tmax: number }[];
  hourly: { time: string; temp: number; code: number }[];
}
const cache = new Map<string, { at: number; data: WeatherPayload }>();
const TTL = 30 * 60_000;

async function geocode(city: string): Promise<{ name: string; region: string | null; lat: number; lon: number } | null> {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d?.results?.[0];
  if (!hit) return null;
  return { name: hit.name, region: hit.admin1 ?? hit.country ?? null, lat: hit.latitude, lon: hit.longitude };
}

async function forecast(lat: number, lon: number) {
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
    date,
    code: d.daily.weather_code?.[i] ?? 0,
    tmax: Math.round(d.daily.temperature_2m_max?.[i] ?? 0),
    tmin: Math.round(d.daily.temperature_2m_min?.[i] ?? 0),
  }));

  // Courbe horaire : à partir de l'heure courante, ~24 h.
  const times: string[] = d.hourly?.time ?? [];
  const nowTime = String(d.current.time ?? "");
  let startIdx = times.findIndex(t => t >= nowTime);
  if (startIdx < 0) startIdx = 0;
  const hourly = times.slice(startIdx, startIdx + 24).map((time, k) => ({
    time,
    temp: Math.round(d.hourly.temperature_2m?.[startIdx + k] ?? 0),
    code: d.hourly.weather_code?.[startIdx + k] ?? 0,
  }));

  return {
    timezone: d.timezone ?? null,
    time: d.current.time ?? null,
    current: { temp: Math.round(d.current.temperature_2m ?? 0), code: d.current.weather_code ?? 0, wind: Math.round(d.current.wind_speed_10m ?? 0), isDay: d.current.is_day !== 0 },
    daily, hourly,
  };
}

// GET /api/weather[?city=] — météo de la ville du profil (ou ?city= en aperçu).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let city = (new URL(req.url).searchParams.get("city") || "").trim();
  if (!city) {
    // Ville stockée dans user_extras (source de vérité).
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

  try {
    const geo = await geocode(city);
    if (!geo) return NextResponse.json({ city, error: "Ville introuvable" }, { status: 404 });
    const fc = await forecast(geo.lat, geo.lon);
    if (!fc) return NextResponse.json({ city: geo.name, error: "Météo indisponible" }, { status: 502 });
    const data: WeatherPayload = { city: geo.name, region: geo.region, ...fc };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ city, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
