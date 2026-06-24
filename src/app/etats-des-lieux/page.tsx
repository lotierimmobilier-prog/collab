"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";
const GOLD_BG = "#F7F0E6";
const BORDER = "#e5e7eb";

const EDL_TYPES = [
  { value: "entrant",  label: "Entrant",  icon: "📥", color: "#059669" },
  { value: "sortant",  label: "Sortant",  icon: "📤", color: "#dc2626" },
  { value: "releve",   label: "Relevé d'état", icon: "📋", color: "#d97706" },
];

const PIECE_TYPES = ["Entrée", "Séjour", "Chambre 1", "Chambre 2", "Cuisine", "Salle de bain", "WC", "Balcon", "Cave", "Garage", "Autre"];
const ETATS = ["Très bon état", "Bon état", "État d'usage", "Mauvais état"];

interface Lot { id: string; address: string; label?: string; reference: string; }
interface Tenant { id: string; prenom: string; nom: string; }

interface Piece {
  id: string; name: string; etat: string; observations: string;
}

interface EDL {
  id: string;
  lotId: string;
  tenantId?: string;
  type: string;
  date: string;
  compteurElec?: string;
  compteurGaz?: string;
  compteurEau?: string;
  nbCles?: number;
  pieces: Piece[];
  remarquesGenerales?: string;
  lot?: Lot;
  tenant?: Tenant;
}

function newPiece(name: string): Piece {
  return { id: Math.random().toString(36).slice(2), name, etat: "Bon état", observations: "" };
}

const STORE_KEY = "collab_edl_list";
function loadEDLs(): EDL[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
}
function saveEDLs(list: EDL[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

export default function EtatsDesLieuxPage() {
  const [lots, setLots]       = useState<Lot[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [edls, setEdls]       = useState<EDL[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<EDL | null>(null);

  /* Formulaire */
  const [form, setForm] = useState<Partial<EDL>>({
    type: "entrant", date: new Date().toISOString().slice(0, 10),
    pieces: PIECE_TYPES.slice(0, 5).map(newPiece), nbCles: 2,
  });

  useEffect(() => {
    Promise.all([fetch("/api/lots"), fetch("/api/locataires")])
      .then(([lr, tr]) => Promise.all([lr.json(), tr.json()]))
      .then(([l, t]) => { setLots(l); setTenants(t); setLoading(false); });
    setEdls(loadEDLs());
  }, []);

  function saveEDL() {
    if (!form.lotId || !form.type) return;
    const lot = lots.find(l => l.id === form.lotId);
    const tenant = tenants.find(t => t.id === form.tenantId);
    const newEdl: EDL = {
      id: Date.now().toString(),
      lotId: form.lotId!, type: form.type!, date: form.date || new Date().toISOString().slice(0, 10),
      tenantId: form.tenantId, compteurElec: form.compteurElec, compteurGaz: form.compteurGaz,
      compteurEau: form.compteurEau, nbCles: form.nbCles, pieces: form.pieces ?? [],
      remarquesGenerales: form.remarquesGenerales,
      lot, tenant,
    };
    const updated = [newEdl, ...edls];
    setEdls(updated);
    saveEDLs(updated);
    setShowForm(false);
    setForm({ type: "entrant", date: new Date().toISOString().slice(0, 10), pieces: PIECE_TYPES.slice(0, 5).map(newPiece), nbCles: 2 });
  }

  function deleteEDL(id: string) {
    const updated = edls.filter(e => e.id !== id);
    setEdls(updated);
    saveEDLs(updated);
    if (selected?.id === id) setSelected(null);
  }

  function printEDL(edl: EDL) {
    const typeInfo = EDL_TYPES.find(t => t.value === edl.type);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EDL ${edl.date}</title>
<style>body{font-family:Arial,sans-serif;max-width:780px;margin:30px auto;padding:0 20px;color:#111;font-size:13px}
h1{font-size:18px;border-bottom:2px solid #B8966A;padding-bottom:8px;color:#B8966A}
h2{font-size:14px;margin:16px 0 8px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
td,th{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5;font-weight:600}
.row{display:flex;gap:20px;margin-bottom:8px}
.field{flex:1}.field label{font-weight:600;font-size:11px;color:#666;display:block}
.field span{font-size:13px}
.sig{margin-top:50px;display:flex;gap:40px}
</style></head><body>
<h1>État des lieux — ${typeInfo?.label ?? edl.type}</h1>
<div class="row">
  <div class="field"><label>Date</label><span>${new Date(edl.date).toLocaleDateString("fr-FR")}</span></div>
  <div class="field"><label>Bien</label><span>${edl.lot?.label || edl.lot?.address || "—"}</span></div>
  <div class="field"><label>Locataire</label><span>${edl.tenant ? `${edl.tenant.prenom} ${edl.tenant.nom}` : "—"}</span></div>
</div>
<div class="row">
  ${edl.compteurElec ? `<div class="field"><label>Compteur électricité</label><span>${edl.compteurElec}</span></div>` : ""}
  ${edl.compteurGaz  ? `<div class="field"><label>Compteur gaz</label><span>${edl.compteurGaz}</span></div>` : ""}
  ${edl.compteurEau  ? `<div class="field"><label>Compteur eau</label><span>${edl.compteurEau}</span></div>` : ""}
  ${edl.nbCles != null ? `<div class="field"><label>Nombre de clés remises</label><span>${edl.nbCles}</span></div>` : ""}
</div>
<h2>État des pièces</h2>
<table>
  <thead><tr><th>Pièce</th><th>État</th><th>Observations</th></tr></thead>
  <tbody>
    ${(edl.pieces ?? []).map(p => `<tr><td>${p.name}</td><td>${p.etat}</td><td>${p.observations || ""}</td></tr>`).join("")}
  </tbody>
</table>
${edl.remarquesGenerales ? `<h2>Remarques générales</h2><p>${edl.remarquesGenerales}</p>` : ""}
<div class="sig">
  <div><p style="font-weight:600">Gestionnaire</p><br/><br/>_______________________</div>
  <div><p style="font-weight:600">Locataire</p><br/><br/>_______________________</div>
</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function addPiece() {
    setForm(f => ({ ...f, pieces: [...(f.pieces ?? []), newPiece("Pièce")] }));
  }
  function updatePiece(idx: number, field: keyof Piece, val: string) {
    setForm(f => {
      const pieces = [...(f.pieces ?? [])];
      pieces[idx] = { ...pieces[idx], [field]: val };
      return { ...f, pieces };
    });
  }
  function removePiece(idx: number) {
    setForm(f => { const p = [...(f.pieces ?? [])]; p.splice(idx, 1); return { ...f, pieces: p }; });
  }

  const inputStyle: React.CSSProperties = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="edl" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>⌂ États des lieux</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>{edls.length} état(s) enregistré(s)</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Nouvel état des lieux
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Liste */}
          <div style={{ width: 340, borderRight: `1px solid ${BORDER}`, overflowY: "auto", background: "#fff" }}>
            {loading && <div style={{ padding: 20, color: "#9ca3af", fontSize: 13 }}>Chargement…</div>}
            {!loading && edls.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⌂</div>
                Aucun état des lieux
              </div>
            )}
            {edls.map(edl => {
              const typeInfo = EDL_TYPES.find(t => t.value === edl.type);
              return (
                <div key={edl.id} onClick={() => setSelected(edl)}
                  style={{ padding: "12px 16px", borderBottom: `1px solid #f3f4f6`, cursor: "pointer", background: selected?.id === edl.id ? GOLD_BG : "transparent", borderLeft: selected?.id === edl.id ? `3px solid ${GOLD}` : "3px solid transparent" }}
                  onMouseEnter={e => selected?.id !== edl.id && (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => selected?.id !== edl.id && (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ background: (typeInfo?.color ?? "#9ca3af") + "18", color: typeInfo?.color ?? "#9ca3af", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      {typeInfo?.icon} {typeInfo?.label}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{new Date(edl.date).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{edl.lot?.label || edl.lot?.address || "Bien non défini"}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{edl.tenant ? `${edl.tenant.prenom} ${edl.tenant.nom}` : "Locataire non défini"}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{(edl.pieces ?? []).length} pièce(s)</div>
                </div>
              );
            })}
          </div>

          {/* Détail */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {!selected && !showForm && (
              <div style={{ textAlign: "center", paddingTop: 80, color: "#9ca3af" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⌂</div>
                <div style={{ fontSize: 14 }}>Sélectionnez un état des lieux ou créez-en un nouveau</div>
              </div>
            )}

            {selected && !showForm && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
                      {EDL_TYPES.find(t => t.value === selected.type)?.icon} {selected.lot?.label || selected.lot?.address}
                    </h2>
                    <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                      {selected.tenant ? `${selected.tenant.prenom} ${selected.tenant.nom} · ` : ""}
                      {new Date(selected.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => printEDL(selected)} style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
                      🖨 Imprimer
                    </button>
                    <button onClick={() => { if (confirm("Supprimer cet EDL ?")) deleteEDL(selected.id); }}
                      style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
                      Supprimer
                    </button>
                  </div>
                </div>

                {/* Relevés */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Électricité", value: selected.compteurElec },
                    { label: "Gaz", value: selected.compteurGaz },
                    { label: "Eau", value: selected.compteurEau },
                    { label: "Clés remises", value: selected.nbCles != null ? `${selected.nbCles}` : undefined },
                  ].filter(r => r.value).map((r, i) => (
                    <div key={i} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.value}</div>
                    </div>
                  ))}
                </div>

                {/* Pièces */}
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: "#374151" }}>Pièces</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ padding: "8px 16px", textAlign: "left", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>Pièce</th>
                        <th style={{ padding: "8px 16px", textAlign: "left", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>État</th>
                        <th style={{ padding: "8px 16px", textAlign: "left", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.pieces ?? []).map((p, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                          <td style={{ padding: "8px 16px", fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: "8px 16px" }}>
                            <span style={{ background: p.etat.includes("Très bon") ? "#d1fae5" : p.etat.includes("Bon") ? "#dbeafe" : p.etat.includes("usage") ? "#fef3c7" : "#fee2e2", color: p.etat.includes("Très bon") ? "#059669" : p.etat.includes("Bon") ? "#2563eb" : p.etat.includes("usage") ? "#d97706" : "#dc2626", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{p.etat}</span>
                          </td>
                          <td style={{ padding: "8px 16px", color: "#6b7280" }}>{p.observations || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selected.remarquesGenerales && (
                  <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>REMARQUES GÉNÉRALES</div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{selected.remarquesGenerales}</div>
                  </div>
                )}
              </div>
            )}

            {/* Formulaire de création */}
            {showForm && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Nouvel état des lieux</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Type *</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                      {EDL_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Date *</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Bien *</label>
                    <select value={form.lotId ?? ""} onChange={e => setForm(f => ({ ...f, lotId: e.target.value }))} style={inputStyle}>
                      <option value="">— Sélectionner —</option>
                      {lots.map(l => <option key={l.id} value={l.id}>{l.label || l.address}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Locataire</label>
                    <select value={form.tenantId ?? ""} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} style={inputStyle}>
                      <option value="">— Sélectionner —</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
                    </select>
                  </div>
                </div>

                {/* Relevés de compteurs */}
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Relevés & clés</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {[
                      { key: "compteurElec" as const, label: "Électricité (kWh)" },
                      { key: "compteurGaz" as const, label: "Gaz (m³)" },
                      { key: "compteurEau" as const, label: "Eau (m³)" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>{f.label}</label>
                        <input value={(form as Record<string, unknown>)[f.key] as string ?? ""} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder="0" style={{ ...inputStyle, padding: "6px 8px" }} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Nb clés remises</label>
                      <input type="number" value={form.nbCles ?? 2} onChange={e => setForm(f => ({ ...f, nbCles: Number(e.target.value) }))} style={{ ...inputStyle, padding: "6px 8px" }} />
                    </div>
                  </div>
                </div>

                {/* Pièces */}
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Pièces</div>
                    <button onClick={addPiece} style={{ background: GOLD_BG, color: GOLD, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>+ Ajouter</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(form.pieces ?? []).map((p, i) => (
                      <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 8, alignItems: "center" }}>
                        <input value={p.name} onChange={e => updatePiece(i, "name", e.target.value)}
                          list="piece-list" style={{ ...inputStyle, padding: "6px 8px" }} placeholder="Pièce" />
                        <datalist id="piece-list">{PIECE_TYPES.map(pt => <option key={pt} value={pt} />)}</datalist>
                        <select value={p.etat} onChange={e => updatePiece(i, "etat", e.target.value)} style={{ ...inputStyle, padding: "6px 8px" }}>
                          {ETATS.map(et => <option key={et} value={et}>{et}</option>)}
                        </select>
                        <input value={p.observations} onChange={e => updatePiece(i, "observations", e.target.value)}
                          style={{ ...inputStyle, padding: "6px 8px" }} placeholder="Observations…" />
                        <button onClick={() => removePiece(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remarques */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Remarques générales</label>
                  <textarea value={form.remarquesGenerales ?? ""} onChange={e => setForm(f => ({ ...f, remarquesGenerales: e.target.value }))}
                    rows={3} style={{ ...inputStyle, resize: "none" }} placeholder="Observations générales sur le logement…" />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveEDL} disabled={!form.lotId}
                    style={{ background: form.lotId ? GOLD : "#e5e7eb", color: form.lotId ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Enregistrer
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", color: "#374151" }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
