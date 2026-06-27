import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { type DayEntry, dayHours, monthDays, totals, round2 } from "@/lib/decompte";

export interface DecompteData {
  societe?: string | null;
  employe?: string | null;
  month: string;        // "YYYY-MM"
  monthLabel: string;
  heureHebdo?: number | null;
  entries: DayEntry[];
  avantageNature?: string | null;
  acompte?: number | null;
  acompteMode?: string | null;
  primeMotif?: string | null;
  primeMontant?: number | null;
  agentSignatureName?: string | null;
  agentSignedAt?: Date | string | null;
  directionSignatureName?: string | null;
  directionSignedAt?: Date | string | null;
}

const GOLD = rgb(0.72, 0.59, 0.42);
const DARK = rgb(0.11, 0.10, 0.09);
const GREY = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.80, 0.78, 0.74);

export async function buildDecomptePdf(data: DecompteData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, MARGIN = 28;
  let y = 841.89 - 34;

  const txt = (s: string, x: number, yy: number, size = 7, f = font, color = DARK) =>
    page.drawText(s ?? "", { x, y: yy, size, font: f, color });
  const hline = (yy: number, x1 = MARGIN, x2 = W - MARGIN) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.5, color: LINE });

  // ── Titre + en-tête ──
  txt("DÉCOMPTE DES HEURES", MARGIN, y, 14, bold, GOLD);
  txt(data.monthLabel.toUpperCase(), W - MARGIN - bold.widthOfTextAtSize(data.monthLabel.toUpperCase(), 11), y, 11, bold, DARK);
  y -= 20;
  txt(`Société : ${data.societe || "-"}`, MARGIN, y, 9, bold);
  txt(`Heure hebdomadaire : ${data.heureHebdo != null ? data.heureHebdo + " h" : "-"}`, W - MARGIN - 150, y, 9);
  y -= 13;
  txt(`Employé(e) : ${data.employe || "-"}`, MARGIN, y, 9, bold);
  txt(`Période de paie : ${data.monthLabel}`, W - MARGIN - 150, y, 9);
  y -= 14;

  // ── Colonnes du tableau ──
  const cols = [
    { k: "jour", label: "Jour", x: MARGIN, w: 78 },
    { k: "m", label: "Matin (arr.–dép.)", x: MARGIN + 78, w: 78 },
    { k: "a", label: "Après-midi", x: MARGIN + 156, w: 78 },
    { k: "s", label: "Soir", x: MARGIN + 234, w: 78 },
    { k: "nuit", label: "Nuit", x: MARGIN + 312, w: 30 },
    { k: "pan", label: "Pan.", x: MARGIN + 342, w: 26 },
    { k: "obs", label: "Observations", x: MARGIN + 368, w: 121 },
    { k: "tot", label: "Total", x: MARGIN + 489, w: 50 },
  ];
  const headY = y;
  page.drawRectangle({ x: MARGIN, y: headY - 11, width: W - 2 * MARGIN, height: 13, color: rgb(0.97, 0.94, 0.90) });
  for (const c of cols) txt(c.label, c.x + 2, headY - 8, 6.5, bold, DARK);
  y = headY - 11;
  hline(y);

  const byDay = new Map(data.entries.map(e => [e.d, e]));
  const days = monthDays(data.month);
  const rowH = 16.5;
  let count = 0;
  const fmt = (v?: string) => v || "";

  for (const { d, weekday } of days) {
    y -= rowH;
    const e = byDay.get(d) || { d };
    const isWeekend = weekday === "Dimanche" || weekday === "Samedi";
    if (isWeekend) page.drawRectangle({ x: MARGIN, y: y, width: W - 2 * MARGIN, height: rowH, color: rgb(0.98, 0.98, 0.97) });
    const ty = y + 5;
    txt(`${String(d).padStart(2, "0")} ${weekday.slice(0, 3)}`, cols[0].x + 2, ty, 6.5);
    txt(`${fmt(e.m1)}${e.m1 || e.m2 ? "–" : ""}${fmt(e.m2)}`, cols[1].x + 2, ty, 6.5);
    txt(`${fmt(e.a1)}${e.a1 || e.a2 ? "–" : ""}${fmt(e.a2)}`, cols[2].x + 2, ty, 6.5);
    txt(`${fmt(e.s1)}${e.s1 || e.s2 ? "–" : ""}${fmt(e.s2)}`, cols[3].x + 2, ty, 6.5);
    txt(e.nuit ? String(e.nuit) : "", cols[4].x + 2, ty, 6.5);
    txt(e.panier ? "X" : "", cols[5].x + 8, ty, 6.5);
    txt((e.obs || "").slice(0, 34), cols[6].x + 2, ty, 6, font, GREY);
    const dh = dayHours(e);
    txt(dh ? round2(dh).toFixed(2) : "", cols[7].x + 2, ty, 6.5, bold);
    hline(y);
    if (++count % 7 === 0) page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: GOLD });
  }

  // ── Totaux ──
  const t = totals(data.month, data.entries);
  y -= 16;
  txt(`Total du mois : ${t.monthTotal.toFixed(2)} h`, MARGIN, y, 9, bold, GOLD);
  txt(`Dont nuit : ${t.nuitTotal.toFixed(2)} h`, MARGIN + 150, y, 8);
  txt(`Paniers : ${t.paniers}`, MARGIN + 250, y, 8);
  y -= 12;
  txt("Totaux hebdomadaires : " + t.weeks.map((w, i) => `S${i + 1} ${w.hours.toFixed(2)}h`).join("   "), MARGIN, y, 7, font, GREY);

  // ── Avantages / prime / acompte ──
  y -= 18;
  const extras: string[] = [];
  if (data.avantageNature) extras.push(`Avantage en nature : ${data.avantageNature}`);
  if (data.primeMontant) extras.push(`Prime${data.primeMotif ? ` (${data.primeMotif})` : ""} : ${data.primeMontant} €`);
  if (data.acompte) extras.push(`Acompte : ${data.acompte} €${data.acompteMode ? ` (${data.acompteMode})` : ""}`);
  if (extras.length) { txt(extras.join("     "), MARGIN, y, 8); y -= 14; }

  // ── Signatures ──
  y -= 10;
  hline(y); y -= 14;
  const sig = (label: string, name?: string | null, at?: Date | string | null, x = MARGIN) => {
    txt(label, x, y, 8, bold);
    if (name) {
      txt(`Signé électroniquement par ${name}`, x, y - 12, 7, font, GREY);
      if (at) txt(`le ${new Date(at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`, x, y - 22, 7, font, GREY);
    } else txt("— en attente —", x, y - 12, 7, font, GREY);
  };
  sig("Signature de l'employé(e) :", data.agentSignatureName, data.agentSignedAt, MARGIN);
  sig("Signature de l'employeur :", data.directionSignatureName, data.directionSignedAt, W / 2 + 10);

  y -= 40;
  txt("Fiche à conserver pendant 5 ans — art. L.143-14 du Code du travail.", MARGIN, y, 6.5, font, GREY);

  return doc.save();
}
