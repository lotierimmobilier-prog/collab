"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  conserve: { label: "Conservé",  color: "#6366F1", bg: "#EEF2FF" },
  restitue: { label: "Restitué",  color: "#059669", bg: "#F0FDF4" },
  partiel:  { label: "Partiel",   color: "#D97706", bg: "#FFFBEB" },
};

interface Bail { id: string; reference: string; lot: { reference: string; label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string } }[] }
interface Depot { id: string; bailId: string; bail: Bail; montant: number; dateRecep: string; dateRestitution: string | null; montantRestitue: number | null; status: string; notes: string | null }

const EMPTY = { bailId: "", montant: "", dateRecep: new Date().toISOString().slice(0,10), dateRestitution: "", montantRestitue: "", status: "conserve", notes: "" };

export default function DepotsPage() {
  const [depots, setDepots]   = useState<Depot[]>([]);
  const [baux, setBaux]       = useState<Bail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/depots-garantie").then(r => r.json()),
      fetch("/api/baux").then(r => r.json()),
    ]).then(([d, b]) => { setDepots(d); setBaux(b); }).finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const body = { ...editing, montant: parseFloat(editing.montant), montantRestitue: editing.montantRestitue ? parseFloat(editing.montantRestitue) : null, dateRestitution: editing.dateRestitution || null };
    const res = await fetch("/api/depots-garantie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const saved = await res.json();
    setDepots(p => [saved, ...p]);
    setSaving(false); setShowModal(false); setEditing(null);
  }

  const totalConserves = depots.filter(d => d.status === "conserve").reduce((s, d) => s + d.montant, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Dépôts de garantie</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{depots.length} dépôt{depots.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY }); setShowModal(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Enregistrer</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: GOLD_BG, borderRadius: 10, padding: "16px 20px", border: `1px solid ${GOLD}44` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{totalConserves.toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>Total conservé</div>
        </div>
        <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "16px 20px", border: "1px solid #C7D2FE" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#6366F1" }}>{depots.filter(d => d.status === "conserve").length}</div>
          <div style={{ fontSize: 11, color: "#4338CA", marginTop: 2 }}>Dépôts conservés</div>
        </div>
        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "16px 20px", border: "1px solid #BBF7D0" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>{depots.filter(d => d.status === "restitue").length}</div>
          <div style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>Restitués</div>
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Bail / Lot","Locataire","Montant","Date réception","Restitution","Statut"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {depots.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun dépôt enregistré</td></tr>}
              {depots.map(d => {
                const st = STATUS[d.status] ?? STATUS.conserve;
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{d.bail.reference}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{d.bail.lot.label || d.bail.lot.address}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      {d.bail.tenants.map(bt => <div key={bt.tenant.prenom}>{bt.tenant.prenom} {bt.tenant.nom}</div>)}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: GOLD }}>{d.montant.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{new Date(d.dateRecep).toLocaleDateString("fr-FR")}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      {d.dateRestitution ? (
                        <div>
                          <div>{new Date(d.dateRestitution).toLocaleDateString("fr-FR")}</div>
                          {d.montantRestitue != null && <div style={{ fontSize: 11, color: "#059669" }}>{d.montantRestitue.toLocaleString("fr-FR")} €</div>}
                        </div>
                      ) : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(460px,98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Enregistrer un dépôt</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <F label="Bail *">
                <select value={editing.bailId} onChange={e => setEditing(p => ({ ...p!, bailId: e.target.value }))} style={inp}>
                  <option value="">— Choisir —</option>
                  {baux.map(b => <option key={b.id} value={b.id}>{(b as typeof b & { reference: string }).reference} – {(b as typeof b & { lot: { label: string | null; address: string } }).lot.label || (b as typeof b & { lot: { address: string } }).lot.address}</option>)}
                </select>
              </F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Montant *"><input type="number" value={editing.montant} onChange={e => setEditing(p => ({ ...p!, montant: e.target.value }))} style={inp} /></F>
                <F label="Date réception *"><input type="date" value={editing.dateRecep} onChange={e => setEditing(p => ({ ...p!, dateRecep: e.target.value }))} style={inp} /></F>
              </div>
              <F label="Statut">
                <select value={editing.status} onChange={e => setEditing(p => ({ ...p!, status: e.target.value }))} style={inp}>
                  <option value="conserve">Conservé</option>
                  <option value="partiel">Partiel</option>
                  <option value="restitue">Restitué</option>
                </select>
              </F>
              {(editing.status === "restitue" || editing.status === "partiel") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <F label="Date restitution"><input type="date" value={editing.dateRestitution} onChange={e => setEditing(p => ({ ...p!, dateRestitution: e.target.value }))} style={inp} /></F>
                  <F label="Montant restitué"><input type="number" value={editing.montantRestitue} onChange={e => setEditing(p => ({ ...p!, montantRestitue: e.target.value }))} style={inp} /></F>
                </div>
              )}
              <F label="Notes"><textarea value={editing.notes} onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))} rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} /></F>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={saving || !editing.bailId || !editing.montant} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
    {children}
  </div>;
}
const inp: React.CSSProperties = { height: 36, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
