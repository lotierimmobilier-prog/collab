"use client";
import { useState } from "react";
import {
  Dossier, STATUS_STYLES, calcTauxEndettement, gliEligible, dossierCompletion,
} from "@/lib/locataires";
import DossierDetail from "./DossierDetail";
import NewDossierModal from "./NewDossierModal";

export default function LocatairesBoard() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [selected, setSelected] = useState<Dossier | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = dossiers.filter(d => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (search && !`${d.nom} ${d.prenom} ${d.bien}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function addDossier(d: Dossier) { setDossiers(prev => [d, ...prev]); setShowNew(false); }
  function updateDossier(updated: Dossier) {
    setDossiers(prev => prev.map(d => d.id === updated.id ? updated : d));
    setSelected(updated);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", flex: "0 0 220px" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9ca3af" }}>🔍</span>
          <input
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 30, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#f9fafb" }}
          />
        </div>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {/* Lien candidature — pas de window.location pour éviter l'hydration mismatch */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "6px 12px" }}>
          <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 500 }}>🔗 Lien candidature</span>
          <code style={{ fontSize: 11, color: "#6b7280", background: "#ede9fe", borderRadius: 4, padding: "2px 6px" }}>
            /candidature
          </code>
          <button
            onClick={() => { if (typeof window !== "undefined") navigator.clipboard?.writeText(window.location.origin + "/candidature"); }}
            style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}
          >Copier</button>
        </div>

        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Nouveau dossier</button>
      </div>

      {/* Stats bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "10px 24px", display: "flex", gap: 20, flexWrap: "wrap" }}>
        {Object.entries(STATUS_STYLES).map(([k, v]) => {
          const count = dossiers.filter(d => d.status === k).length;
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: v.bg, color: v.text, borderRadius: 5, padding: "1px 8px", fontSize: 11, fontWeight: 500 }}>{v.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Aucun dossier locataire</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
              Partagez le lien <code style={{ background: "#f3f4f6", borderRadius: 4, padding: "1px 6px" }}>/candidature</code> ou créez un dossier manuellement.
            </div>
            <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Créer un dossier</button>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 100px 120px 90px 80px 24px", padding: "10px 16px", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", gap: 12 }}>
              <span>Candidat</span><span>Bien</span><span>Loyer CC</span><span>Taux endett.</span><span>GLI</span><span>Statut</span><span />
            </div>

            {filtered.map((d, i) => {
              const taux = calcTauxEndettement(d.loyerCC, d.revenus);
              const gli = gliEligible(taux, d.revenus, d.loyerCC);
              const completion = dossierCompletion(d.uploads, d.situationLogement);
              const s = STATUS_STYLES[d.status];
              return (
                <div key={d.id} onClick={() => setSelected(d)} style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 100px 120px 90px 80px 24px",
                  padding: "12px 16px", gap: 12, alignItems: "center",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f9fafb" : "none",
                  cursor: "pointer",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: "#111827" }}>{d.prenom} {d.nom}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{d.email}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: "#f3f4f6", borderRadius: 2 }}>
                        <div style={{ width: `${completion}%`, height: "100%", borderRadius: 2, background: completion === 100 ? "#10b981" : "#f59e0b" }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{completion}%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{d.bien || "—"}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{d.typeContrat}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{d.loyerCC ? `${d.loyerCC.toLocaleString("fr-FR")} €` : "—"}</span>
                  <div>
                    {taux > 0 ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: taux > 33 ? "#dc2626" : taux > 28 ? "#d97706" : "#059669" }}>{taux}%</span>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                    {d.revenus > 0 && <div style={{ fontSize: 10, color: "#9ca3af" }}>{d.revenus.toLocaleString("fr-FR")} € / mois</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: gli.ok ? "#059669" : "#dc2626" }}>{gli.ok ? "✓ Éligible" : "✗ Non élig."}</span>
                  <span style={{ background: s.bg, color: s.text, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>{s.label}</span>
                  <span style={{ color: "#9ca3af" }}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <DossierDetail dossier={selected} onClose={() => setSelected(null)} onUpdate={updateDossier} />}
      {showNew && <NewDossierModal onClose={() => setShowNew(false)} onAdd={addDossier} />}
    </div>
  );
}

const selectStyle: React.CSSProperties = { height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, padding: "0 10px", background: "#f9fafb", color: "#374151", outline: "none" };
const btnPrimary: React.CSSProperties = { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
