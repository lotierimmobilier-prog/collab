"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

interface Bail { monthlyRent: number; charges: number; status: string }
interface Owner { id: string; prenom: string; nom: string }
interface Lot { id: string; reference: string; label: string | null; address: string; lotType: string; surface: number | null; rooms: number | null; floor: number | null; status: string; ownerId: string | null; owner: Owner | null; notes: string | null; baux: Bail[] }

const TYPE_LABEL: Record<string, string> = { apartment: "Appartement", house: "Maison", commercial: "Commercial", parking: "Parking", storage: "Cave/Local" };
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  vacant:    { label: "Vacant",    color: "#DC2626", bg: "#FEF2F2" },
  occupied:  { label: "Occupé",   color: "#059669", bg: "#F0FDF4" },
  under_work:{ label: "Travaux",  color: "#D97706", bg: "#FFFBEB" },
};

const EMPTY: Partial<Lot & { ownerId: string }> = { reference: "", label: "", address: "", lotType: "apartment", surface: undefined, rooms: undefined, floor: undefined, status: "vacant", ownerId: "" };

export default function LotsPage() {
  const [lots, setLots]       = useState<Lot[]>([]);
  const [owners, setOwners]   = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Lot & { ownerId: string }> | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/lots").then(r => r.json()),
      fetch("/api/proprietaires").then(r => r.json()),
    ]).then(([l, o]) => { setLots(l); setOwners(o); }).finally(() => setLoading(false));
  }, []);

  const filtered = lots.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${l.reference} ${l.label ?? ""} ${l.address} ${l.owner?.nom ?? ""}`.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function save() {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/lots" : `/api/lots/${editing.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, surface: editing.surface ? Number(editing.surface) : null, rooms: editing.rooms ? Number(editing.rooms) : null, floor: editing.floor !== undefined ? Number(editing.floor) : null }),
    });
    const saved = await res.json();
    const owner = owners.find(o => o.id === saved.ownerId) ?? null;
    if (isNew) setLots(p => [{ ...saved, owner, baux: [] }, ...p]);
    else setLots(p => p.map(l => l.id === saved.id ? { ...l, ...saved, owner } : l));
    setSaving(false); setShowModal(false); setEditing(null);
  }

  const counts = { all: lots.length, vacant: lots.filter(l => l.status === "vacant").length, occupied: lots.filter(l => l.status === "occupied").length, under_work: lots.filter(l => l.status === "under_work").length };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Lots & Biens</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{lots.length} lot{lots.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY }); setShowModal(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau lot
        </button>
      </div>

      {/* Filtres statut */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["all", "Tous", "#374151"], ["vacant", "Vacants", "#DC2626"], ["occupied", "Occupés", "#059669"], ["under_work", "Travaux", "#D97706"]].map(([k, l, c]) => (
          <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filterStatus === k ? c : "#E6E1D9"}`, background: filterStatus === k ? c + "18" : "#fff", color: filterStatus === k ? c : "#6b7280", fontSize: 12, fontWeight: filterStatus === k ? 700 : 400, cursor: "pointer" }}>
            {l} <span style={{ fontSize: 11 }}>({counts[k as keyof typeof counts]})</span>
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
          style={{ marginLeft: "auto", height: 34, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 12, outline: "none", width: 220, background: "#fff" }} />
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
                {["Réf.","Adresse","Type","Surface","Propriétaire","Statut","Loyer CC",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun résultat</td></tr>}
              {filtered.map(l => {
                const st  = STATUS_STYLE[l.status] ?? STATUS_STYLE.vacant;
                const rent = l.baux.filter(b => b.status === "active").reduce((s, b) => s + b.monthlyRent + b.charges, 0);
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: GOLD }}>{l.reference}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{l.label || l.address}</div>
                      {l.label && <div style={{ fontSize: 11, color: "#6b7280" }}>{l.address}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{TYPE_LABEL[l.lotType] ?? l.lotType}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{l.surface ? `${l.surface} m²` : "—"}{l.rooms ? ` · ${l.rooms}p` : ""}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{l.owner ? `${l.owner.prenom} ${l.owner.nom}` : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: rent > 0 ? GOLD : "#9ca3af" }}>
                      {rent > 0 ? `${rent.toLocaleString("fr-FR")} €` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => { setEditing({ ...l, ownerId: l.ownerId ?? "" }); setShowModal(true); }} style={{ background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: GOLD, fontWeight: 500 }}>
                        Modifier
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(580px, 98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing.id ? "Modifier" : "Nouveau"} lot</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <F label="Référence *"><input value={editing.reference ?? ""} onChange={e => setEditing(p => ({ ...p!, reference: e.target.value }))} style={inp} /></F>
                <F label="Libellé"><input value={editing.label ?? ""} onChange={e => setEditing(p => ({ ...p!, label: e.target.value }))} style={inp} placeholder="ex: Appt 3ème étage" /></F>
              </div>
              <F label="Adresse *"><input value={editing.address ?? ""} onChange={e => setEditing(p => ({ ...p!, address: e.target.value }))} style={inp} /></F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Type de bien">
                  <select value={editing.lotType ?? "apartment"} onChange={e => setEditing(p => ({ ...p!, lotType: e.target.value }))} style={inp}>
                    <option value="apartment">Appartement</option>
                    <option value="house">Maison</option>
                    <option value="commercial">Local commercial</option>
                    <option value="parking">Parking</option>
                    <option value="storage">Cave / Local</option>
                  </select>
                </F>
                <F label="Statut">
                  <select value={editing.status ?? "vacant"} onChange={e => setEditing(p => ({ ...p!, status: e.target.value }))} style={inp}>
                    <option value="vacant">Vacant</option>
                    <option value="occupied">Occupé</option>
                    <option value="under_work">En travaux</option>
                  </select>
                </F>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <F label="Surface (m²)"><input type="number" value={editing.surface ?? ""} onChange={e => setEditing(p => ({ ...p!, surface: e.target.value as unknown as number }))} style={inp} /></F>
                <F label="Pièces"><input type="number" value={editing.rooms ?? ""} onChange={e => setEditing(p => ({ ...p!, rooms: e.target.value as unknown as number }))} style={inp} /></F>
                <F label="Étage"><input type="number" value={editing.floor ?? ""} onChange={e => setEditing(p => ({ ...p!, floor: e.target.value as unknown as number }))} style={inp} /></F>
              </div>
              <F label="Propriétaire">
                <select value={editing.ownerId ?? ""} onChange={e => setEditing(p => ({ ...p!, ownerId: e.target.value }))} style={inp}>
                  <option value="">— Aucun —</option>
                  {owners.map(o => <option key={o.id} value={o.id}>{o.prenom} {o.nom}</option>)}
                </select>
              </F>
              <F label="Notes"><textarea value={editing.notes ?? ""} onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} /></F>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={saving || !editing.reference || !editing.address} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
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
