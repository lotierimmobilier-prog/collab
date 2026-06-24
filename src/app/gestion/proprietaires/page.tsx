"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

interface Owner { id: string; prenom: string; nom: string; ownerType: string; email: string | null; phone: string | null; mobile: string | null; companyName: string | null; address: string | null; lots: { id: string; status: string; baux: { monthlyRent: number; charges: number }[] }[] }

const TYPE_LABEL: Record<string, string> = { individual: "Particulier", sci: "SCI", company: "Société" };
const TYPE_COLOR: Record<string, string> = { individual: "#2563EB", sci: "#7C3AED", company: "#059669" };

const EMPTY: Partial<Owner> = { prenom: "", nom: "", ownerType: "individual", email: "", phone: "", mobile: "", companyName: "", address: "" };

export default function ProprietairesPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Owner> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/proprietaires").then(r => r.json()).then(setOwners).finally(() => setLoading(false)); }, []);

  const filtered = owners.filter(o => {
    const q = search.toLowerCase();
    return !q || `${o.prenom} ${o.nom} ${o.companyName ?? ""} ${o.email ?? ""}`.toLowerCase().includes(q);
  });

  async function save() {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/proprietaires" : `/api/proprietaires/${editing.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const saved = await res.json();
    if (isNew) setOwners(p => [saved, ...p]);
    else setOwners(p => p.map(o => o.id === saved.id ? { ...o, ...saved } : o));
    setSaving(false); setShowModal(false); setEditing(null);
  }

  function openNew() { setEditing({ ...EMPTY }); setShowModal(true); }
  function openEdit(o: Owner) { setEditing({ ...o }); setShowModal(true); }

  return (
    <div style={{ padding: 24 }}>
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Propriétaires</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{owners.length} propriétaire{owners.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={openNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau propriétaire
        </button>
      </div>

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un propriétaire…"
        style={{ width: "100%", maxWidth: 380, height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", marginBottom: 16, boxSizing: "border-box", background: "#fff" }} />

      {/* Table */}
      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
                {["Nom / Société","Type","Contact","Lots","Loyer mensuel",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun résultat</td></tr>
              )}
              {filtered.map(o => {
                const totalRent = o.lots.reduce((s, l) => s + l.baux.reduce((s2, b) => s2 + b.monthlyRent + b.charges, 0), 0);
                const lotsCount = o.lots.length;
                const occupied  = o.lots.filter(l => l.status === "occupied").length;
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid #f3f4f6`, cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{o.prenom} {o.nom}</div>
                      {o.companyName && <div style={{ fontSize: 11, color: "#6b7280" }}>{o.companyName}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: (TYPE_COLOR[o.ownerType] ?? "#6b7280") + "18", color: TYPE_COLOR[o.ownerType] ?? "#6b7280", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                        {TYPE_LABEL[o.ownerType] ?? o.ownerType}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {o.email && <div style={{ fontSize: 12, color: "#374151" }}>{o.email}</div>}
                      {o.phone && <div style={{ fontSize: 11, color: "#6b7280" }}>{o.phone}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>
                      {lotsCount > 0 ? <><span style={{ fontWeight: 600 }}>{lotsCount}</span> lot{lotsCount > 1 ? "s" : ""} · <span style={{ color: "#059669" }}>{occupied} occ.</span></> : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: totalRent > 0 ? GOLD : "#9ca3af" }}>
                      {totalRent > 0 ? `${totalRent.toLocaleString("fr-FR")} €` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => openEdit(o)} style={{ background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: GOLD, fontWeight: 500 }}>
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

      {/* Modal création / édition */}
      {showModal && editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(540px, 98vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing.id ? "Modifier" : "Nouveau"} propriétaire</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <Row>
                <Field label="Type" required>
                  <select value={editing.ownerType ?? "individual"} onChange={e => setEditing(p => ({ ...p!, ownerType: e.target.value }))}
                    style={inputStyle}>
                    <option value="individual">Particulier</option>
                    <option value="sci">SCI</option>
                    <option value="company">Société</option>
                  </select>
                </Field>
              </Row>
              <Row>
                <Field label="Prénom" required><input value={editing.prenom ?? ""} onChange={e => setEditing(p => ({ ...p!, prenom: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Nom" required><input value={editing.nom ?? ""} onChange={e => setEditing(p => ({ ...p!, nom: e.target.value }))} style={inputStyle} /></Field>
              </Row>
              {(editing.ownerType === "sci" || editing.ownerType === "company") && (
                <Field label="Raison sociale"><input value={editing.companyName ?? ""} onChange={e => setEditing(p => ({ ...p!, companyName: e.target.value }))} style={inputStyle} /></Field>
              )}
              <Row>
                <Field label="Email"><input type="email" value={editing.email ?? ""} onChange={e => setEditing(p => ({ ...p!, email: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Téléphone"><input value={editing.phone ?? ""} onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))} style={inputStyle} /></Field>
              </Row>
              <Row>
                <Field label="Mobile"><input value={editing.mobile ?? ""} onChange={e => setEditing(p => ({ ...p!, mobile: e.target.value }))} style={inputStyle} /></Field>
              </Row>
              <Field label="Adresse"><input value={editing.address ?? ""} onChange={e => setEditing(p => ({ ...p!, address: e.target.value }))} style={inputStyle} /></Field>
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

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}
const inputStyle: React.CSSProperties = { height: 36, border: "1px solid #E6E1D9", borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
