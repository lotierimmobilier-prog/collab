"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

interface Bail { id: string; reference: string; monthlyRent: number; charges: number; lot: { reference: string; address: string } }
interface BailTenant { bail: Bail }
interface Tenant { id: string; prenom: string; nom: string; email: string | null; phone: string | null; mobile: string | null; address: string | null; birthDate: string | null; profession: string | null; notes: string | null; baux: BailTenant[] }

const EMPTY: Partial<Tenant> = { prenom: "", nom: "", email: "", phone: "", mobile: "", address: "", birthDate: "", profession: "", notes: "" };

export default function LocatairesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Tenant> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/tenants").then(r => r.json()).then(setTenants).finally(() => setLoading(false)); }, []);

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    return !q || `${t.prenom} ${t.nom} ${t.email ?? ""} ${t.phone ?? ""}`.toLowerCase().includes(q);
  });

  async function save() {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/tenants" : `/api/tenants/${editing.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const saved = await res.json();
    if (isNew) setTenants(p => [{ ...saved, baux: [] }, ...p]);
    else setTenants(p => p.map(t => t.id === saved.id ? { ...t, ...saved } : t));
    setSaving(false); setShowModal(false); setEditing(null);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Locataires</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{tenants.length} locataire{tenants.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY }); setShowModal(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau locataire
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un locataire…"
        style={{ width: "100%", maxWidth: 380, height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", marginBottom: 16, boxSizing: "border-box", background: "#fff" }} />

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
                {["Locataire","Contact","Bail actif","Loyer",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun résultat</td></tr>}
              {filtered.map(t => {
                const activeBail = t.baux?.[0]?.bail;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{t.prenom} {t.nom}</div>
                      {t.profession && <div style={{ fontSize: 11, color: "#6b7280" }}>{t.profession}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {t.email && <div style={{ fontSize: 12, color: "#374151" }}>{t.email}</div>}
                      {t.phone && <div style={{ fontSize: 11, color: "#6b7280" }}>{t.phone}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      {activeBail ? (
                        <div>
                          <div style={{ fontWeight: 500, color: "#374151" }}>{activeBail.lot.reference}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeBail.lot.address}</div>
                        </div>
                      ) : <span style={{ color: "#9ca3af" }}>Pas de bail actif</span>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: activeBail ? GOLD : "#9ca3af" }}>
                      {activeBail ? `${(activeBail.monthlyRent + activeBail.charges).toLocaleString("fr-FR")} €` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => { setEditing({ ...t }); setShowModal(true); }} style={{ background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: GOLD, fontWeight: 500 }}>
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
          <div style={{ background: "#fff", borderRadius: 14, width: "min(540px, 98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing.id ? "Modifier" : "Nouveau"} locataire</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Prénom *"><input value={editing.prenom ?? ""} onChange={e => setEditing(p => ({ ...p!, prenom: e.target.value }))} style={inp} /></F>
                <F label="Nom *"><input value={editing.nom ?? ""} onChange={e => setEditing(p => ({ ...p!, nom: e.target.value }))} style={inp} /></F>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Email"><input type="email" value={editing.email ?? ""} onChange={e => setEditing(p => ({ ...p!, email: e.target.value }))} style={inp} /></F>
                <F label="Téléphone"><input value={editing.phone ?? ""} onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))} style={inp} /></F>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Mobile"><input value={editing.mobile ?? ""} onChange={e => setEditing(p => ({ ...p!, mobile: e.target.value }))} style={inp} /></F>
                <F label="Profession"><input value={editing.profession ?? ""} onChange={e => setEditing(p => ({ ...p!, profession: e.target.value }))} style={inp} /></F>
              </div>
              <F label="Adresse"><input value={editing.address ?? ""} onChange={e => setEditing(p => ({ ...p!, address: e.target.value }))} style={inp} /></F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Date de naissance"><input type="date" value={editing.birthDate ?? ""} onChange={e => setEditing(p => ({ ...p!, birthDate: e.target.value }))} style={inp} /></F>
              </div>
              <F label="Notes"><textarea value={editing.notes ?? ""} onChange={e => setEditing(p => ({ ...p!, notes: e.target.value }))} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} /></F>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={saving || !editing.prenom || !editing.nom} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
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
