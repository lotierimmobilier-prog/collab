// Parseurs de relevés bancaires : OFX et QIF → opérations normalisées.

export interface ParsedTxn { date: string; label: string; amount: number }

function parseOfxDate(raw: string): string {
  // OFX : YYYYMMDD[HHMMSS][.xxx][TZ]
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return new Date().toISOString();
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`).toISOString();
}

/** Parse un export OFX (balises SGML simples). */
export function parseOfx(text: string): ParsedTxn[] {
  const txns: ParsedTxn[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const get = (tag: string) => {
      const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
      const m = re.exec(b);
      return m ? m[1].trim() : "";
    };
    const dt = get("DTPOSTED");
    const amt = parseFloat(get("TRNAMT").replace(",", "."));
    const name = get("NAME") || get("MEMO") || "Opération";
    const memo = get("MEMO");
    if (!dt || isNaN(amt)) continue;
    txns.push({ date: parseOfxDate(dt), label: [name, memo].filter(Boolean).join(" — ").slice(0, 200), amount: amt });
  }
  return txns;
}

/** Parse un export QIF (lignes préfixées, enregistrements séparés par ^). */
export function parseQif(text: string): ParsedTxn[] {
  const txns: ParsedTxn[] = [];
  let cur: { date?: string; amount?: number; payee?: string; memo?: string } = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const code = line[0];
    const val = line.slice(1).trim();
    if (code === "^") {
      if (cur.date && cur.amount != null) {
        txns.push({ date: cur.date, label: [cur.payee, cur.memo].filter(Boolean).join(" — ").slice(0, 200) || "Opération", amount: cur.amount });
      }
      cur = {};
    } else if (code === "D") {
      // QIF date : D/M'YY ou DD/MM/YYYY selon la locale ; on tente plusieurs formats.
      const parts = val.replace(/'/g, "/").split(/[\/.\-]/).map(s => parseInt(s, 10));
      if (parts.length >= 3) {
        let [d, mo, y] = parts;
        if (y < 100) y += 2000;
        // format US possible (M/D/Y) — on garde D/M/Y (France) par défaut
        if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
        cur.date = new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00`).toISOString();
      }
    } else if (code === "T" || code === "U") {
      cur.amount = parseFloat(val.replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
    } else if (code === "P") { cur.payee = val; }
    else if (code === "M") { cur.memo = val; }
  }
  return txns;
}

export function parseStatement(format: string, text: string): ParsedTxn[] {
  if (format === "ofx") return parseOfx(text);
  if (format === "qif") return parseQif(text);
  return [];
}
