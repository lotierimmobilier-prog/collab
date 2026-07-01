// Pointes de trésorerie : extraction du montant depuis un PDF (Auguste) et
// génération d'un PDF d'alerte de dépassement de garantie financière.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getAnthropic, MODELS, extractJson } from "@/lib/auguste";
import { fmtEuro } from "@/lib/comptabilite";

// Lit le montant total de la pointe de trésorerie dans un PDF (base64).
export async function extractPointeAmount(base64: string): Promise<number | null> {
  try {
    const resp = await getAnthropic().messages.create({
      model: MODELS.smart,
      max_tokens: 300,
      system: "Tu extrais un montant depuis un document de trésorerie. Réponds UNIQUEMENT en JSON.",
      messages: [{
        role: "user",
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } } as any,
          { type: "text", text: `Ce document est une « pointe de trésorerie » (solde des fonds mandants gérés par l'agence). Donne le MONTANT TOTAL de la pointe (le plus élevé / le solde global des fonds détenus), en euros. Réponds strictement : {"montant": 12345.67} (nombre, point décimal). Si tu ne trouves pas, {"montant": null}.` },
        ],
      }],
    });
    const text = resp.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("");
    const parsed = extractJson<{ montant: number | null }>(text);
    const m = parsed?.montant;
    return typeof m === "number" && isFinite(m) ? m : null;
  } catch {
    return null;
  }
}

const LABELS: Record<string, string> = { gestion: "Gestion locative", syndic: "Syndic" };

// Génère un PDF d'alerte de dépassement (aux couleurs sobres de l'agence).
export async function buildAlertPdf(opts: { service: string; amount: number; garantie: number; fileName: string; link: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.722, 0.588, 0.416);
  const dark = rgb(0.11, 0.102, 0.09);
  const red = rgb(0.792, 0.09, 0.09);
  let y = 780;
  const draw = (t: string, x: number, size: number, f = font, c = dark) => { page.drawText(t, { x, y, size, font: f, color: c }); };

  draw("LOTIER IMMOBILIER", 50, 20, bold, gold); y -= 16;
  draw("Alerte — pointe de trésorerie", 50, 12, font, dark); y -= 34;
  page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: 545, y: y + 12 }, thickness: 1, color: gold }); y -= 14;

  draw("Dépassement de la garantie financière", 50, 16, bold, red); y -= 30;
  draw(`Service : ${LABELS[opts.service] ?? opts.service}`, 50, 12); y -= 20;
  draw(`Montant de la pointe : ${fmtEuro(opts.amount)}`, 50, 12, bold); y -= 20;
  draw(`Garantie financière : ${fmtEuro(opts.garantie)}`, 50, 12); y -= 20;
  draw(`Dépassement : ${fmtEuro(opts.amount - opts.garantie)}`, 50, 12, bold, red); y -= 30;

  const wrap = "Le montant des fonds mandants détenus dépasse le plafond de la garantie financière. Une régularisation ou un relèvement de la garantie peut être nécessaire.";
  for (const line of wrapText(wrap, 90)) { draw(line, 50, 11, font, dark); y -= 16; }
  y -= 14;
  draw("Document concerné :", 50, 11, bold); y -= 16;
  draw(opts.fileName, 50, 11, font, dark); y -= 16;
  draw(opts.link, 50, 10, font, gold); y -= 16;

  return doc.save();
}

function wrapText(s: string, max: number): string[] {
  const words = s.split(" "); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
