import { NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

// Météo de l'adresse de l'appartement du locataire + conseils adaptés.
interface Payload { city: string; current: { temp: number; code: number; label: string; emoji: string }; daily: { date: string; tmin: number; tmax: number; code: number; emoji: string }[]; conseils: string[] }
const cache = new Map<string, { at: number; data: Payload }>();
const TTL = 30 * 60_000;

function wmo(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Ciel dégagé", emoji: "☀️" };
  if (code <= 2) return { label: "Peu nuageux", emoji: "🌤️" };
  if (code === 3) return { label: "Couvert", emoji: "☁️" };
  if (code <= 48) return { label: "Brouillard", emoji: "🌫️" };
  if (code <= 57) return { label: "Bruine", emoji: "🌦️" };
  if (code <= 67) return { label: "Pluie", emoji: "🌧️" };
  if (code <= 77) return { label: "Neige", emoji: "🌨️" };
  if (code <= 82) return { label: "Averses", emoji: "🌦️" };
  if (code <= 86) return { label: "Averses de neige", emoji: "🌨️" };
  if (code >= 95) return { label: "Orage", emoji: "⛈️" };
  return { label: "—", emoji: "🌡️" };
}

// Extrait une ville exploitable d'une adresse française.
function cityFromAddress(addr: string): string {
  const a = (addr || "").replace(/\s+/g, " ").trim();
  const m = a.match(/\b\d{5}\s+([A-Za-zÀ-ÿ'’\- ]+)$/);
  if (m) return m[1].trim();
  const seg = a.split(",").map(s => s.trim()).filter(Boolean);
  if (seg.length) return seg[seg.length - 1].replace(/^\d{4,5}\s*/, "").trim() || a;
  return a;
}

function conseils(temp: number, code: number): string[] {
  const out: string[] = [];
  const month = new Date().getMonth(); // 0 = janvier
  if (temp <= 4) out.push("Grand froid : vérifiez votre chauffage et, par gel, laissez filer un mince filet d'eau la nuit pour protéger les canalisations.");
  if (temp >= 30) out.push("Forte chaleur : fermez volets et fenêtres la journée, aérez tôt le matin et tard le soir.");
  if (code >= 51 && code <= 67) out.push("Pluie : vérifiez l'étanchéité des fenêtres ; en cas d'infiltration, signalez-le via Auguste.");
  if (code >= 71 && code <= 86) out.push("Neige/verglas : prudence aux abords ; protégez les compteurs exposés du gel.");
  if (code >= 45 && code <= 48) out.push("Brouillard / humidité : aérez 10 minutes par jour pour éviter la condensation et les moisissures.");
  // Conseils saisonniers (toujours utiles)
  if (month >= 9 || month <= 1) out.push("Avant l'hiver : pensez à l'entretien annuel de votre chaudière — vous pouvez déposer l'attestation dans « Mes justificatifs ».");
  if (month >= 4 && month <= 8) out.push("Saison chaude : un entretien de votre climatisation est recommandé ; déposez le justificatif ici.");
  out.push("Vérifiez régulièrement vos détecteurs de fumée et aérez votre logement chaque jour.");
  return out.slice(0, 3);
}

export async function GET() {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Adresse de l'appartement (lot du bail), sinon adresse du locataire.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link: any = await prisma.bailTenant.findFirst({ where: { tenantId: client.id }, include: { bail: { include: { lot: true } } }, orderBy: { id: "desc" } }).catch(() => null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t: any = await prisma.tenant.findUnique({ where: { id: client.id }, select: { address: true } }).catch(() => null);
  const address = link?.bail?.lot?.address || t?.address || "";
  if (!address) return NextResponse.json({ error: "Adresse de l'appartement inconnue." }, { status: 404 });

  const city = cityFromAddress(address);
  const ck = city.toLowerCase();
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  try {
    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
    const gd = await g.json();
    const geo = gd?.results?.[0];
    if (!geo) return NextResponse.json({ error: "Ville introuvable", city }, { status: 404 });
    const f = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto`);
    const fd = await f.json();
    if (!fd?.current || !fd?.daily) return NextResponse.json({ error: "Météo indisponible" }, { status: 502 });
    const cw = wmo(fd.current.weather_code ?? 0);
    const daily = (fd.daily.time ?? []).map((date: string, i: number) => ({
      date, tmin: Math.round(fd.daily.temperature_2m_min?.[i] ?? 0), tmax: Math.round(fd.daily.temperature_2m_max?.[i] ?? 0),
      code: fd.daily.weather_code?.[i] ?? 0, emoji: wmo(fd.daily.weather_code?.[i] ?? 0).emoji,
    }));
    const data: Payload = {
      city: geo.name,
      current: { temp: Math.round(fd.current.temperature_2m ?? 0), code: fd.current.weather_code ?? 0, label: cw.label, emoji: cw.emoji },
      daily,
      conseils: conseils(Math.round(fd.current.temperature_2m ?? 0), fd.current.weather_code ?? 0),
    };
    cache.set(ck, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Météo indisponible" }, { status: 502 });
  }
}
