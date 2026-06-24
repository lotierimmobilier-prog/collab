"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

interface Tenant { id: string; prenom: string; nom: string; email: string | null }
interface BailTenant { tenant: Tenant }
interface Lot { id: string; reference: string; address: string; label: string | null }
interface Bail {
  id: string; reference: string; lotId: string; lot: Lot;
  leaseType: string; status: string; renewalType: string;
  startDate: string; endDate: string | null; signedDate: string | null;
  monthlyRent: number; charges: number; deposit: number | null;
  notes: string | null; tenants: BailTenant[];
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: "Actif",      color: "#059669", bg: "#F0FDF4" },
  terminated: { label: "Résilié",    color: "#DC2626", bg: "#FEF2F2" },
  suspended:  { label: "Suspendu",   color: "#D97706", bg: "#FFFBEB" },
  pending:    { label: "En attente", color: "#6366F1", bg: "#EEF2FF" },
};
const LEASE: Record<string, string> = { residential: "Résidentiel", commercial: "Commercial", mixed: "Mixte" };

const EMPTY = { lotId: "", leaseType: "residential", startDate: "", endDate: "", monthlyRent: "", charges: "0", deposit: "", renewalType: "tacit", status: "active", notes: "", tenantIds: [] as string[] };

export default function BauxPage() {
  const [baux, setBaux]       = useState<Bail[]>([]);
  const [lots, setLots]       = useState<Lot[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/baux").then(r => r.json()),
      fetch("/api/lots").then(r => r.json()),
      fetch("/api/tenants").then(r => r.json()),
    ]).then(([b, l, t]) => { setBaux(b); setLots(l); setTenants(t); }).finally(() => setLoading(false));
  }, []);

  const filtered = baux.filter(b => {
    const q = search.toLowerCase();
    const match = !q || `${b.reference} ${b.lot.reference} ${b.lot.address} ${b.tenants.map(bt => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(" ")}`.toLowerCase().includes(q);
    return match && (filterStatus === "all" || b.status === filterStatus);
  });

  function openNew() { setEditing({ ...EMPTY }); setShowModal(true); }
  function openEdit(b: Bail) {
    setEditing({ id: b.id, lotId: b.lotId, leaseType: b.leaseType, startDate: b.startDate?.slice(0, 10) ?? "", endDate: b.endDate?.slice(0, 10) ?? "", monthlyRent: String(b.monthlyRent), charges: String(b.charges), deposit: b.deposit != null ? String(b.deposit) : "", renewalType: b.renewalType, status: b.status, notes: b.notes ?? "", tenantIds: b.tenants.map(bt => bt.tenant.id) });
    setShowModal(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const body = { ...editing, monthlyRent: parseFloat(editing.monthlyRent as string) || 0, charges: parseFloat(editing.charges as string) || 0, deposit: editing.deposit ? parseFloat(editing.deposit as string) : null };
    const res = await fetch(isNew ? "/api/baux" : `/api/baux/${editing.id}`, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const saved = await res.json();
    if (isNew) setBaux(p => [saved, ...p]);
    else setBaux(p => p.map(b => b.id === saved.id ? saved : b));
    setSaving(false); setShowModal(false); setEditing(null);
  }

  function toggleTenant(id: string) {
    if (!editing) return;
    setEditing(p => ({ ...p!, tenantIds: p!.tenantIds.includes(id) ? p!.tenantIds.filter(x => x !== id) : [...p!.tenantIds, id] }));
  }

  const counts = { all: baux.length, active: baux.filter(b => b.status === "active").length, terminated: baux.filter(b => b.status === "terminated").length };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Baux</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{baux.length} bail{baux.length > 1 ? "x" : ""}</p>
        </div>
        <button onClick={openNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Nouveau bail</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        {[["all","Tous","#374151"],["active","Actifs","#059669"],["terminated","Résiliés","#DC2626"]].map(([k,l,c]) => (
          <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filterStatus===k?c:"#E6E1D9"}`, background: filterStatus===k?c+"18":"#fff", color: filterStatus===k?c:"#6b7280", fontSize: 12, fontWeight: filterStatus===k?700:400, cursor: "pointer" }}>
            {l} <span style={{ fontSize: 11 }}>({counts[k as keyof typeof counts] ?? baux.length})</span>
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
          style={{ marginLeft: "auto", height: 34, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 12, outline: "none", width: 220, background: "#fff" }} />
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Référence","Lot","Locataire(s)","Type","Début","Loyer CC","Dépôt","Statut",""].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun résultat</td></tr>}
              {filtered.map(b => {
                const st = STATUS[b.status] ?? STATUS.pending;
                return (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: GOLD }}>{b.reference}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{b.lot.reference}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{b.lot.label || b.lot.address}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      {b.tenants.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span>
                        : b.tenants.map(bt => <div key={bt.tenant.id}>{bt.tenant.prenom} {bt.tenant.nom}</div>)}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{LEASE[b.leaseType] ?? b.leaseType}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{new Date(b.startDate).toLocaleDateString("fr-FR")}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: GOLD }}>{(b.monthlyRent + b.charges).toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{b.deposit ? `${b.deposit.toLocaleString("fr-FR")} €` : "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => openEdit(b)} style={{ background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: GOLD, fontWeight: 500 }}>Modifier</button>
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
          <div style={{ background: "#fff", borderRadius: 14, width: "min(600px,98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing.id ? "Modifier" : "Nouveau"} bail</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <F label="Lot *">
                <select value={editing.lotId} onChange={e => setEditing(p => ({ ...p!, lotId: e.target.value }))} style={inp}>
                  <option value="">— Choisir un lot —</option>
                  {lots.map(l => <option key={l.id} value={l.id}>{l.reference} – {l.label || l.address}</option>)}
                </select>
              </F>
              <F label="Locataire(s)">
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
                  {tenants.map(t => (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={editing.tenantIds.includes(t.id)} onChange={() => toggleTenant(t.id)} style={{ accentColor: GOLD }} />
                      {t.prenom} {t.nom}
                    </label>
                  ))}
                </div>
              </F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Type de bail">
                  <select value={editing.leaseType} onChange={e => setEditing(p => ({ ...p!, leaseType: e.target.value }))} style={inp}>
                    <option value="residential">Résidentiel</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed">Mixte</option>
                  </select>
                </F>
                <F label="Statut">
                  <select value={editing.status} onChange={e => setEditing(p => ({ ...p!, status: e.target.value }))} style={inp}>
                    <option value="pending">En attente</option>
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                    <option value="terminated">Résilié</option>
                  </select>
                </F>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Début *"><input type="date" value={editing.startDate} onChange={e => setEditing(p => ({ ...p!, startDate: e.target.value }))} style={inp} /></F>
                <F label="Fin (si fixe)"><input type="date" value={editing.endDate} onChange={e => setEditing(p => ({ ...p!, endDate: e.target.value }))} style={inp} /></F>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <F label="Loyer hors charges *"><input type="number" value={editing.monthlyRent} onChange={e => setEditing(p => ({ ...p!, monthlyRent: e.target.value }))} style={inp} placeholder="0.00" /></F>
                <F label="Charges"><input type="number" value={editing.charges} onChange={e => setEditing(p => ({ ...p!, charges: e.target.value }))} style={inp} placeholder="0.00" /></F>
                <F label="Dépôt de garantie"><input type="number" value={editing.deposit} onChange={e => setEditing(p => ({ ...p!, deposit: e.target.value }))} style={inp} placeholder="0.00" /></F>
              </div>
              <F label="Renouvellement">
                <select value={editing.renewalType} onChange={e => setEditing(p => ({ ...p!, renewalType: e.target.value }))} style={inp}>
                  <option value="tacit">Tacite reconduction</option>
                  <option value="fixed">Durée fixe</option>
                </select>
              </F>
              <F label="Notes"><textarea value={editing.notes} onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} /></F>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={saving || !editing.lotId || !editing.startDate || !editing.monthlyRent}
                style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
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
