"use client";
import { useEffect, useState } from "react";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
interface Bail { id: string; reference: string; monthlyRent: number; lot: { label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string } }[] }
interface AplEntry { bailId: string; montant: number; dateVersement: string }
export default function AplPage() {
  const [baux, setBaux] = useState<Bail[]>([]);
  const [apls, setApls] = useState<AplEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ bailId: "", montant: "", dateVersement: new Date().toISOString().slice(0,10) });
  useEffect(() => { fetch("/api/baux").then(r => r.json()).then((b: (Bail & { status: string })[]) => setBaux(b.filter(x => x.status === "active"))).finally(() => setLoading(false)); }, []);
  function add() {
    if (!form.bailId || !form.montant) return;
    setApls(p => [{ ...form, montant: parseFloat(form.montant) }, ...p]);
    setForm(f => ({ ...f, montant: "", bailId: "" }));
  }
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>APL / Allocations logement</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Suivi des versements CAF / MSA</p>
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Saisir un versement APL</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
          <select value={form.bailId} onChange={e => setForm(p => ({ ...p, bailId: e.target.value }))} style={inp}>
            <option value="">— Choisir un bail —</option>
            {baux.map(b => <option key={b.id} value={b.id}>{b.reference} – {b.lot.label || b.lot.address}</option>)}
          </select>
          <input type="number" value={form.montant} onChange={e => setForm(p => ({ ...p, montant: e.target.value }))} placeholder="Montant €" style={inp} />
          <input type="date" value={form.dateVersement} onChange={e => setForm(p => ({ ...p, dateVersement: e.target.value }))} style={inp} />
          <button onClick={add} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ajouter</button>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
            {["Bail","Lot","Locataire","Montant APL","Date versement"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {apls.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun versement APL enregistré</td></tr>}
            {apls.map((a, i) => {
              const bail = baux.find(b => b.id === a.bailId);
              return (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }} onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 12, color: GOLD }}>{bail?.reference ?? "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{bail?.lot.label || bail?.lot.address || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{bail?.tenants.map(bt => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(", ") || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#059669" }}>{a.montant.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{new Date(a.dateVersement).toLocaleDateString("fr-FR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const inp: React.CSSProperties = { height: 36, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
