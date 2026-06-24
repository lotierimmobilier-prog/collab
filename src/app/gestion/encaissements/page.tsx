"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";
const MODES: Record<string, string> = { virement: "Virement", cheque: "Chèque", especes: "Espèces", prelevement: "Prélèvement" };

interface Bail { id: string; reference: string; lot: { reference: string; label: string | null }; tenants: { tenant: { prenom: string; nom: string } }[] }
interface Appel { reference: string; periode: string }
interface Enc { id: string; reference: string; bailId: string; bail: Bail; appel: Appel | null; montant: number; dateReglement: string; modePaiement: string; reference_paiement: string | null; notes: string | null }

const EMPTY = { bailId: "", appelId: "", montant: "", dateReglement: new Date().toISOString().slice(0,10), modePaiement: "virement", reference_paiement: "", notes: "" };

export default function EncaissementsPage() {
  const [encs, setEncs]       = useState<Enc[]>([]);
  const [baux, setBaux]       = useState<Bail[]>([]);
  const [appels, setAppels]   = useState<{ id: string; reference: string; periode: string; bailId: string; totalCC: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/encaissements").then(r => r.json()),
      fetch("/api/baux").then(r => r.json()),
      fetch("/api/appels-loyer").then(r => r.json()),
    ]).then(([e, b, a]) => { setEncs(e); setBaux(b); setAppels(a); }).finally(() => setLoading(false));
  }, []);

  const bailAppels = appels.filter(a => a.bailId === editing?.bailId && (a as typeof a & { status: string }).status !== "regle");

  async function save() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch("/api/encaissements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editing, montant: parseFloat(editing.montant) }) });
    const saved = await res.json();
    setEncs(p => [saved, ...p]);
    setSaving(false); setShowModal(false); setEditing(null);
  }

  const total = encs.reduce((s, e) => s + e.montant, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Encaissements</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{encs.length} règlement{encs.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY }); setShowModal(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Saisir un encaissement</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: GOLD_BG, borderRadius: 10, padding: "16px 20px", border: `1px solid ${GOLD}44` }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{total.toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>Total encaissé (tous)</div>
        </div>
        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "16px 20px", border: "1px solid #BBF7D0" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#059669" }}>{encs.filter(e => new Date(e.dateReglement).getMonth() === new Date().getMonth() && new Date(e.dateReglement).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + e.montant, 0).toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>Encaissé ce mois</div>
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Référence","Date","Bail / Lot","Locataire","Appel lié","Montant","Mode"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {encs.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun encaissement</td></tr>}
              {encs.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={x => (x.currentTarget.style.background = "#fafaf8")}
                  onMouseLeave={x => (x.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 12, color: GOLD }}>{e.reference}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{new Date(e.dateReglement).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{e.bail.reference}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{e.bail.lot.label || e.bail.lot.reference}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    {e.bail.tenants.map(bt => <div key={bt.tenant.prenom}>{bt.tenant.prenom} {bt.tenant.nom}</div>)}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#6b7280" }}>{e.appel ? `${e.appel.reference} (${e.appel.periode})` : "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#059669" }}>{e.montant.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ background: "#F3F4F6", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{MODES[e.modePaiement] ?? e.modePaiement}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(480px,98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Saisir un encaissement</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <F label="Bail *">
                <select value={editing.bailId} onChange={e => setEditing(p => ({ ...p!, bailId: e.target.value, appelId: "" }))} style={inp}>
                  <option value="">— Choisir un bail —</option>
                  {baux.map(b => <option key={b.id} value={b.id}>{b.reference} – {b.lot.label || b.lot.reference}</option>)}
                </select>
              </F>
              {editing.bailId && bailAppels.length > 0 && (
                <F label="Appel de loyer associé">
                  <select value={editing.appelId} onChange={e => setEditing(p => ({ ...p!, appelId: e.target.value }))} style={inp}>
                    <option value="">— Aucun —</option>
                    {bailAppels.map(a => <option key={a.id} value={a.id}>{a.reference} · {a.periode} · {a.totalCC.toLocaleString("fr-FR")} €</option>)}
                  </select>
                </F>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Montant *"><input type="number" value={editing.montant} onChange={e => setEditing(p => ({ ...p!, montant: e.target.value }))} style={inp} placeholder="0.00" /></F>
                <F label="Date *"><input type="date" value={editing.dateReglement} onChange={e => setEditing(p => ({ ...p!, dateReglement: e.target.value }))} style={inp} /></F>
              </div>
              <F label="Mode de paiement">
                <select value={editing.modePaiement} onChange={e => setEditing(p => ({ ...p!, modePaiement: e.target.value }))} style={inp}>
                  {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </F>
              <F label="Référence paiement"><input value={editing.reference_paiement} onChange={e => setEditing(p => ({ ...p!, reference_paiement: e.target.value }))} style={inp} placeholder="Numéro chèque, virement…" /></F>
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
