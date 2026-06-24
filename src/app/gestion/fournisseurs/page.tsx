"use client";
import { useEffect, useState } from "react";
const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";
interface Fournisseur { id: string; name: string; category: string; email: string | null; phone: string | null; address: string | null; siret: string | null; notes: string | null }
export default function FournisseursPage() {
  const [items, setItems] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "plomberie", email: "", phone: "", address: "", siret: "", notes: "" });
  const CATS = ["plomberie","electricite","menuiserie","maconnerie","peinture","jardinage","serrurerie","nettoyage","assurance","autre"];
  useEffect(() => { fetch("/api/fournisseurs").then(r => r.json()).then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  const filtered = items.filter(i => !search || `${i.name} ${i.category} ${i.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  async function add() {
    try {
      const res = await fetch("/api/fournisseurs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const saved = await res.json();
      setItems(p => [saved, ...p]);
    } catch { setItems(p => [{ id: crypto.randomUUID(), ...form, email: form.email || null, address: form.address || null, siret: form.siret || null, notes: form.notes || null }, ...p]); }
    setShowModal(false); setForm({ name: "", category: "plomberie", email: "", phone: "", address: "", siret: "", notes: "" });
  }
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Fournisseurs</h1><p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{items.length} fournisseur{items.length > 1 ? "s" : ""}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 12px", fontSize: 12, outline: "none", width: 200, background: "#fff" }} />
          <button onClick={() => setShowModal(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
        </div>
      </div>
      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Nom","Catégorie","Contact","SIRET"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun fournisseur</td></tr>}
              {filtered.map(f => (
                <tr key={f.id} style={{ borderBottom: "1px solid #f3f4f6" }} onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 13 }}>{f.name}</td>
                  <td style={{ padding: "12px 14px" }}><span style={{ background: GOLD_BG, color: GOLD, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{f.category}</span></td>
                  <td style={{ padding: "12px 14px" }}><div style={{ fontSize: 12 }}>{f.email || "—"}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{f.phone || ""}</div></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#6b7280" }}>{f.siret || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(480px,98vw)", overflow: "auto", maxHeight: "90vh", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nouveau fournisseur</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[["Nom *","name","text"],["Email","email","email"],["Téléphone","phone","tel"],["Adresse","address","text"],["SIRET","siret","text"]].map(([l, k, t]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</label>
                  <input type={t} value={(form as Record<string, string>)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} />
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Catégorie</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                  {CATS.map(c => <option key={c} value={c} style={{ textTransform: "capitalize" }}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={add} disabled={!form.name} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const inp: React.CSSProperties = { height: 36, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
