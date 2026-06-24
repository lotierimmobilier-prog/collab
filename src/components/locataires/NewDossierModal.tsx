"use client";
import { useState } from "react";
import { Dossier, calcTauxEndettement, gliEligible, SITUATION_LABELS } from "@/lib/locataires";

const CONTRATS = ["CDI", "CDD", "Intérim", "Indépendant / Freelance", "Étudiant", "Retraité", "Sans emploi"];

export default function NewDossierModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (d: Dossier) => void;
}) {
  const [f, setF] = useState({
    nom: "", prenom: "", email: "", telephone: "",
    bien: "", loyerCC: "", revenus: "",
    typeContrat: "CDI", employeur: "",
    situationLogement: "locataire" as Dossier["situationLogement"],
  });

  const loyerCC = parseFloat(f.loyerCC) || 0;
  const revenus = parseFloat(f.revenus) || 0;
  const taux = calcTauxEndettement(loyerCC, revenus);
  const gli = gliEligible(taux, revenus, loyerCC);

  function set(k: string, v: string) { setF(prev => ({ ...prev, [k]: v })); }

  function submit() {
    if (!f.nom || !f.prenom || !f.email) return;
    onAdd({
      id: Date.now().toString(),
      token: Math.random().toString(36).slice(2, 10),
      nom: f.nom, prenom: f.prenom, email: f.email, telephone: f.telephone,
      bien: f.bien, loyerCC, revenus,
      typeContrat: f.typeContrat, employeur: f.employeur,
      situationLogement: f.situationLogement,
      status: "incomplet", uploads: [],
      createdAt: new Date().toLocaleDateString("fr-FR"),
    });
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 540, maxHeight: "90vh", background: "#fff", borderRadius: 14, zIndex: 50,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Nouveau dossier locataire</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <Group title="Identité">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <F label="Prénom *"><input value={f.prenom} onChange={e => set("prenom", e.target.value)} placeholder="Jean" style={inp} /></F>
              <F label="Nom *"><input value={f.nom} onChange={e => set("nom", e.target.value)} placeholder="Dupont" style={inp} /></F>
              <F label="Email *"><input type="email" value={f.email} onChange={e => set("email", e.target.value)} placeholder="jean@email.fr" style={inp} /></F>
              <F label="Téléphone"><input value={f.telephone} onChange={e => set("telephone", e.target.value)} placeholder="06 00 00 00 00" style={inp} /></F>
            </div>
          </Group>

          <Group title="Bien & loyer">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <F label="Référence du bien"><input value={f.bien} onChange={e => set("bien", e.target.value)} placeholder="T3 Rue Victor Hugo" style={inp} /></F>
              <F label="Loyer CC (€)"><input type="number" value={f.loyerCC} onChange={e => set("loyerCC", e.target.value)} placeholder="800" style={inp} /></F>
            </div>
          </Group>

          <Group title="Situation">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <F label="Type de contrat">
                <select value={f.typeContrat} onChange={e => set("typeContrat", e.target.value)} style={inp}>
                  {CONTRATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </F>
              <F label="Revenus nets / mois (€)"><input type="number" value={f.revenus} onChange={e => set("revenus", e.target.value)} placeholder="2500" style={inp} /></F>
              <F label="Employeur"><input value={f.employeur} onChange={e => set("employeur", e.target.value)} placeholder="Entreprise" style={inp} /></F>
              <F label="Logement actuel">
                <select value={f.situationLogement} onChange={e => set("situationLogement", e.target.value)} style={inp}>
                  {Object.entries(SITUATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </F>
            </div>
          </Group>

          {loyerCC > 0 && revenus > 0 && (
            <div style={{ background: gli.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${gli.ok ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "11px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: gli.ok ? "#166534" : "#991b1b", marginBottom: 2 }}>
                {gli.ok ? "✅" : "❌"} {gli.msg}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                Minimum requis : {(loyerCC * 3).toLocaleString("fr-FR")} € · Taux : {taux}%
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.nom || !f.prenom || !f.email} style={{
            background: (f.nom && f.prenom && f.email) ? "#B8966A" : "#e5e7eb",
            color: (f.nom && f.prenom && f.email) ? "#fff" : "#9ca3af",
            border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Créer le dossier</button>
        </div>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: 500 }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
