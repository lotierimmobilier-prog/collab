"use client";
import { useEffect, useState } from "react";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
const TYPES = ["Chaudière","Ramonage","Détecteur fumée","VMC","Extermination","Autre"];
interface Entretien { id: string; lot: string; type: string; datePrevu: string; statut: string }
export default function RelancesEntretienPage() {
  const [items, setItems] = useState<Entretien[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ lot: "", type: TYPES[0], datePrevu: "", statut: "planifie" });
  const [lots, setLots] = useState<{ id: string; reference: string; label: string | null; address: string }[]>([]);
  useEffect(() => { fetch("/api/lots").then(r => r.json()).then(setLots); }, []);
  function add() {
    setItems(p => [...p, { id: crypto.randomUUID(), ...form }]);
    setShowForm(false);
    setForm({ lot: "", type: TYPES[0], datePrevu: "", statut: "planifie" });
  }
  const ST: Record<string, { label: string; color: string; bg: string }> = {
    planifie: { label: "Planifié", color: "#6366F1", bg: "#EEF2FF" },
    effectue: { label: "Effectué", color: "#059669", bg: "#F0FDF4" },
    a_relancer: { label: "À relancer", color: "#D97706", bg: "#FFFBEB" },
  };
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Relances entretien</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Suivi des entretiens obligatoires</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
            {["Lot","Type","Date prévue","Statut"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun entretien planifié</td></tr>}
            {items.map(item => {
              const st = ST[item.statut] ?? ST.planifie;
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }} onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: GOLD }}>{item.lot}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{item.type}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{item.datePrevu ? new Date(item.datePrevu).toLocaleDateString("fr-FR") : "—"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <select value={item.statut} onChange={e => setItems(p => p.map(i => i.id === item.id ? { ...i, statut: e.target.value } : i))}
                      style={{ background: st.bg, color: st.color, border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                      {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: 400, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Nouvel entretien</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <select value={form.lot} onChange={e => setForm(p => ({ ...p, lot: e.target.value }))} style={inp}>
                <option value="">— Lot —</option>
                {lots.map(l => <option key={l.id} value={l.reference}>{l.reference} – {l.label || l.address}</option>)}
              </select>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="date" value={form.datePrevu} onChange={e => setForm(p => ({ ...p, datePrevu: e.target.value }))} style={inp} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "1px solid #E6E1D9", borderRadius: 7, padding: "7px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={add} disabled={!form.lot} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const inp: React.CSSProperties = { height: 36, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
