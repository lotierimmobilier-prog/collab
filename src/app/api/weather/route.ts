import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Météo via Open-Meteo (gratuit, sans clé). On géocode la ville puis on
// récupère le temps actuel + prévisions 3 jours. Cache mémoire 30 min/ville.
interface WeatherPayload {
  city: string;
  current: { temp: number; code: number };
  daily: { date: string; code: number; tmin: number; tmax: number }[];
}
const cache = new Map<string, { at: number; data: WeatherPayload }>();
const TTL = 30 * 60_000;

async function geocode(city: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d?.results?.[0];
  if (!hit) return null;
  return { name: hit.name, lat: hit.latitude, lon: hit.longitude };
}

async function forecast(lat: number, lon: number): Promise<{ current: WeatherPayload["current"]; daily: WeatherPayload["daily"] } | null> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  if (!d?.current || !d?.daily) return null;
  const daily = (d.daily.time ?? []).map((date: string, i: number) => ({
    date,
    code: d.daily.weather_code?.[i] ?? 0,
    tmin: Math.round(d.daily.temperature_2m_min?.[i] ?? 0),
    tmax: Math.round(d.daily.temperature_2m_max?.[i] ?? 0),
  }));
  return {
    current: { temp: Math.round(d.current.temperature_2m ?? 0), code: d.current.weather_code ?? 0 },
    daily,
  };
}

// GET /api/weather[?city=] — météo de la ville du profil (ou ?city= en aperçu).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let city = (new URL(req.url).searchParams.get("city") || "").trim();
  if (!city) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u: any = await prisma.user.findUnique({ where: { id: session.user.id }, select: { city: true } });
      city = (u?.city || "").trim();
    } catch { /* colonne absente */ }
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
    const data: WeatherPayload = { city: geo.name, current: fc.current, daily: fc.daily };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ city, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
