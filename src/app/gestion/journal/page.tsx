"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

interface Line { date: string; ref: string; label: string; debit: number; credit: number; compte: string }

export default function JournalPage() {
  const [lines, setLines]     = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());

  useEffect(() => {
    // Reconstruit le journal depuis encaissements + appels
    const periode = `${year}-${String(month + 1).padStart(2, "0")}`;
    Promise.all([
      fetch("/api/encaissements").then(r => r.json()),
      fetch("/api/appels-loyer").then(r => r.json()),
    ]).then(([encs, appels]) => {
      const l: Line[] = [];
      for (const e of encs) {
        if (new Date(e.dateReglement).getMonth() === month && new Date(e.dateReglement).getFullYear() === year) {
          l.push({ date: e.dateReglement, ref: e.reference, label: `Encaissement – ${e.bail?.reference ?? ""}`, debit: 0, credit: e.montant, compte: "411" });
        }
      }
      for (const a of appels) {
        if (a.periode === periode) {
          l.push({ date: a.echeance, ref: a.reference, label: `Appel loyer – ${a.bail?.reference ?? ""}`, debit: a.totalCC, credit: 0, compte: "411" });
        }
      }
      l.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setLines(l);
    }).finally(() => setLoading(false));
  }, [month, year]);

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Écritures journal</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Journal des opérations comptables</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={month} onChange={e => setMonth(+e.target.value)} style={sel}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} style={sel}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
                {["Date","Référence","Libellé","Compte","Débit","Crédit"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: h === "Débit" || h === "Crédit" ? "right" : "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucune écriture pour {MONTHS[month]} {year}</td></tr>}
              {lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: GOLD }}>{l.ref}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>{l.label}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#6b7280" }}>{l.compte}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, textAlign: "right", color: "#DC2626", fontWeight: l.debit > 0 ? 600 : 400 }}>{l.debit > 0 ? `${l.debit.toLocaleString("fr-FR")} €` : ""}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, textAlign: "right", color: "#059669", fontWeight: l.credit > 0 ? 600 : 400 }}>{l.credit > 0 ? `${l.credit.toLocaleString("fr-FR")} €` : ""}</td>
                </tr>
              ))}
              {lines.length > 0 && (
                <tr style={{ background: "#FAFAF8", borderTop: `2px solid ${BORDER}` }}>
                  <td colSpan={4} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700 }}>Total</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: "#DC2626" }}>{totalDebit.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: "#059669" }}>{totalCredit.toLocaleString("fr-FR")} €</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
const sel: React.CSSProperties = { height: 34, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#fff" };
