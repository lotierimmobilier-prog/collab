"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

interface Bail { id: string; reference: string; monthlyRent: number; charges: number; status: string; lot: { reference: string; address: string; label: string | null }; tenants: { tenant: { prenom: string; nom: string } }[] }

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function PaiementsPage() {
  const [baux, setBaux]   = useState<Bail[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());

  useEffect(() => { fetch("/api/baux").then(r => r.json()).then(d => setBaux(d.filter((b: Bail) => b.status === "active"))).finally(() => setLoading(false)); }, []);

  const totalLoyers  = baux.reduce((s, b) => s + b.monthlyRent + b.charges, 0);
  const totalCharges = baux.reduce((s, b) => s + b.charges, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Paiements loyers</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{baux.length} bail{baux.length > 1 ? "x" : ""} actif{baux.length > 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={month} onChange={e => setMonth(+e.target.value)} style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#fff" }}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#fff" }}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Loyers attendus", value: `${totalLoyers.toLocaleString("fr-FR")} €`, color: GOLD },
          { label: "Dont charges",    value: `${totalCharges.toLocaleString("fr-FR")} €`, color: "#6366F1" },
          { label: "Baux actifs",     value: String(baux.length), color: "#059669" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{k.label} — {MONTHS[month]} {year}</div>
          </div>
        ))}
      </div>

      {/* Appel vers Encaissements */}
      <div style={{ background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "#92400E" }}>Pour saisir les paiements reçus, utilisez le module <strong>Encaissements</strong>.</div>
        <Link href="/gestion/encaissements" style={{ background: GOLD, color: "#fff", textDecoration: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>Aller aux encaissements →</Link>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Bail","Lot","Locataire","Loyer HC","Charges","Total CC"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {baux.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun bail actif</td></tr>}
              {baux.map(b => (
                <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: GOLD }}>{b.reference}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{b.lot.reference}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{b.lot.label || b.lot.address}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    {b.tenants.length ? b.tenants.map(bt => <div key={bt.tenant.prenom}>{bt.tenant.prenom} {bt.tenant.nom}</div>) : <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151" }}>{b.monthlyRent.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151" }}>{b.charges.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: GOLD }}>{(b.monthlyRent + b.charges).toLocaleString("fr-FR")} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
