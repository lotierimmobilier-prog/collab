"use client";
import { useState } from "react";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
export default function ParametresPage() {
  const [agence, setAgence] = useState({ nom: "Lotier Immobilier", siret: "", tva: "", adresse: "", tel: "", email: "" });
  const [saved, setSaved] = useState(false);
  function save() { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Paramètres</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24 }}>Configuration générale du module Gestion</p>
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Informations de l'agence</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["Nom de l'agence","nom"],["SIRET","siret"],["N° TVA","tva"],["Adresse","adresse"],["Téléphone","tel"],["Email","email"]].map(([l, k]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</label>
              <input value={(agence as Record<string, string>)[k]} onChange={e => setAgence(p => ({ ...p, [k]: e.target.value }))}
                style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" as const }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button onClick={save} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saved ? "✓ Enregistré" : "Enregistrer"}
          </button>
        </div>
      </div>
      <div style={{ marginTop: 20, background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Numérotation automatique</div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
          <div>• Baux : <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>BAIL-{new Date().getFullYear()}-001</code></div>
          <div>• Appels loyer : <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>AL-{new Date().getFullYear()}-0001</code></div>
          <div>• Encaissements : <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>ENC-{new Date().getFullYear()}-0001</code></div>
        </div>
      </div>
    </div>
  );
}
