"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

interface Bail { id: string; reference: string; monthlyRent: number; charges: number; lot: { reference: string; label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string } }[] }
interface Encaissement { id: string; montant: number }
interface Appel { id: string; reference: string; bailId: string; bail: Bail; periode: string; montantHC: number; charges: number; totalCC: number; echeance: string; status: string; notes: string | null; encaissements: Encaissement[] }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  emis:    { label: "Émis",     color: "#6366F1", bg: "#EEF2FF" },
  partiel: { label: "Partiel",  color: "#D97706", bg: "#FFFBEB" },
  regle:   { label: "Réglé",   color: "#059669", bg: "#F0FDF4" },
  impaye:  { label: "Impayé",  color: "#DC2626", bg: "#FEF2F2" },
};

const EMPTY = { bailId: "", periode: "", montantHC: "", charges: "", echeance: "", status: "emis", notes: "" };

export default function AppelsLoyersPage() {
  const [appels, setAppels]   = useState<Appel[]>([]);
  const [baux, setBaux]       = useState<Bail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());

  useEffect(() => {
    Promise.all([
      fetch("/api/appels-loyer").then(r => r.json()),
      fetch("/api/baux").then(r => r.json()),
    ]).then(([a, b]) => { setAppels(a); setBaux(b.filter((x: Bail & { status: string }) => x.status === "active")); }).finally(() => setLoading(false));
  }, []);

  const periode = `${year}-${String(month + 1).padStart(2, "0")}`;
  const filtered = appels.filter(a => a.periode === periode && (filterStatus === "all" || a.status === filterStatus));
  const totalAttendus = filtered.reduce((s, a) => s + a.totalCC, 0);
  const totalRegles   = filtered.filter(a => a.status === "regle").reduce((s, a) => s + a.totalCC, 0);
  const totalImpayes  = filtered.filter(a => a.status === "impaye").reduce((s, a) => s + a.totalCC, 0);

  async function genererAppels() {
    setSaving(true);
    for (const bail of baux) {
      const exists = appels.find(a => a.bailId === bail.id && a.periode === periode);
      if (!exists) {
        const echeance = new Date(year, month, 1);
        const res = await fetch("/api/appels-loyer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bailId: bail.id, periode, montantHC: bail.monthlyRent, charges: bail.charges, echeance: echeance.toISOString() }) });
        const saved = await res.json();
        setAppels(p => [saved, ...p]);
      }
    }
    setSaving(false);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const bail = baux.find(b => b.id === editing.bailId);
    const body = { ...editing, montantHC: parseFloat(editing.montantHC || String(bail?.monthlyRent ?? 0)), charges: parseFloat(editing.charges || String(bail?.charges ?? 0)) };
    const res = await fetch("/api/appels-loyer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const saved = await res.json();
    setAppels(p => [saved, ...p]);
    setSaving(false); setShowModal(false); setEditing(null);
  }

  function openNew() {
    const echeance = new Date(year, month, 1).toISOString().slice(0, 10);
    setEditing({ ...EMPTY, periode, echeance });
    setShowModal(true);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Appels de loyers</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{MONTHS[month]} {year}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={month} onChange={e => setMonth(+e.target.value)} style={sel}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} style={sel}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={genererAppels} disabled={saving || baux.length === 0} style={{ background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            ⚡ Générer tout
          </button>
          <button onClick={openNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Manuel</button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total appelé", value: `${totalAttendus.toLocaleString("fr-FR")} €`, color: GOLD },
          { label: "Réglé",        value: `${totalRegles.toLocaleString("fr-FR")} €`,   color: "#059669" },
          { label: "Impayé",       value: `${totalImpayes.toLocaleString("fr-FR")} €`,  color: "#DC2626" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", borderRadius: 10, padding: "14px 18px", border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Object.entries({ all: "Tous", ...Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label])) }).map(([k, l]) => (
          <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${filterStatus===k?(STATUS[k]?.color??GOLD):"#E6E1D9"}`, background: filterStatus===k?(STATUS[k]?.bg??GOLD_BG):"#fff", color: filterStatus===k?(STATUS[k]?.color??GOLD):"#6b7280", fontSize: 11, fontWeight: filterStatus===k?700:400, cursor: "pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <>
          {filtered.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: 40, textAlign: "center", color: "#9ca3af" }}>
              Aucun appel pour {MONTHS[month]} {year}.
              {baux.length > 0 && <div style={{ marginTop: 8 }}><button onClick={genererAppels} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, cursor: "pointer" }}>Générer les {baux.length} appels</button></div>}
            </div>
          )}
          {filtered.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
                  {["Référence","Bail / Lot","Locataire","Loyer HC","Charges","Total CC","Encaissé","Statut"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(a => {
                    const st = STATUS[a.status] ?? STATUS.emis;
                    const encaisse = a.encaissements.reduce((s, e) => s + e.montant, 0);
                    return (
                      <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 12, color: GOLD }}>{a.reference}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{a.bail.reference}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{a.bail.lot.label || a.bail.lot.address}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12 }}>
                          {a.bail.tenants.map(bt => <div key={bt.tenant.prenom}>{bt.tenant.prenom} {bt.tenant.nom}</div>)}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12 }}>{a.montantHC.toLocaleString("fr-FR")} €</td>
                        <td style={{ padding: "12px 14px", fontSize: 12 }}>{a.charges.toLocaleString("fr-FR")} €</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: GOLD }}>{a.totalCC.toLocaleString("fr-FR")} €</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: encaisse >= a.totalCC ? "#059669" : encaisse > 0 ? "#D97706" : "#9ca3af" }}>
                          {encaisse > 0 ? `${encaisse.toLocaleString("fr-FR")} €` : "—"}
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
        </>
      )}

      {showModal && editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(480px,98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nouvel appel de loyer</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <F label="Bail *">
                <select value={editing.bailId} onChange={e => {
                  const b = baux.find(x => x.id === e.target.value);
                  setEditing(p => ({ ...p!, bailId: e.target.value, montantHC: String(b?.monthlyRent ?? ""), charges: String(b?.charges ?? "") }));
                }} style={inp}>
                  <option value="">— Choisir —</option>
                  {baux.map(b => <option key={b.id} value={b.id}>{b.reference} – {b.lot.label || b.lot.address}</option>)}
                </select>
              </F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Loyer HC"><input type="number" value={editing.montantHC} onChange={e => setEditing(p => ({ ...p!, montantHC: e.target.value }))} style={inp} /></F>
                <F label="Charges"><input type="number" value={editing.charges} onChange={e => setEditing(p => ({ ...p!, charges: e.target.value }))} style={inp} /></F>
              </div>
              <F label="Échéance"><input type="date" value={editing.echeance} onChange={e => setEditing(p => ({ ...p!, echeance: e.target.value }))} style={inp} /></F>
              <F label="Notes"><textarea value={editing.notes} onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))} rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} /></F>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={saving || !editing.bailId} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Génération…" : "Créer"}
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
const sel: React.CSSProperties = { height: 34, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#fff" };
