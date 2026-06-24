"use client";
import { useState } from "react";
import { Encaissement, Transaction, ENCAISSEMENT_LABELS, EncaissementType, formatEur, TVA_TAUX } from "@/lib/compta";

const MODES = ["virement", "cheque", "especes", "autre"] as const;
const MODE_LABELS: Record<string, string> = { virement: "Virement", cheque: "Chèque", especes: "Espèces", autre: "Autre" };

export default function EncaissementsPanel({ encaissements, transactions, onAdd }: {
  encaissements: Encaissement[];
  transactions: Transaction[];
  onAdd: (e: Encaissement) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [f, setF] = useState({
    libelle: "", type: "honoraires_vente" as EncaissementType,
    montantHT: "", tva: String(TVA_TAUX),
    mode: "virement" as typeof MODES[number],
    transactionId: "", reference: "", date: "", notes: "",
  });

  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  const montantHT = parseFloat(f.montantHT) || 0;
  const tvaRate = parseFloat(f.tva) || 0;
  const tvaMontant = Math.round(montantHT * tvaRate) / 100;
  const montantTTC = Math.round((montantHT + tvaMontant) * 100) / 100;

  function submit() {
    if (!f.libelle || !montantHT) return;
    onAdd({
      id: Date.now().toString(),
      transactionId: f.transactionId || undefined,
      libelle: f.libelle,
      type: f.type,
      montantHT,
      tva: tvaRate,
      montantTTC,
      date: f.date || new Date().toLocaleDateString("fr-FR"),
      mode: f.mode,
      reference: f.reference || undefined,
      notes: f.notes || undefined,
    });
    setShowModal(false);
    setF({ libelle: "", type: "honoraires_vente", montantHT: "", tva: String(TVA_TAUX), mode: "virement", transactionId: "", reference: "", date: "", notes: "" });
  }

  const totalHT = encaissements.reduce((s, e) => s + e.montantHT, 0);
  const totalTTC = encaissements.reduce((s, e) => s + e.montantTTC, 0);
  const totalTVA = totalTTC - totalHT;

  return (
    <div>
      {/* Totaux */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <KPI label="Total HT" value={formatEur(totalHT)} color="#059669" />
        <KPI label="TVA collectée" value={formatEur(totalTVA)} color="#f59e0b" />
        <KPI label="Total TTC" value={formatEur(totalTTC)} color="#7c3aed" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Enregistrer un encaissement</button>
      </div>

      {encaissements.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "50px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Aucun encaissement</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Enregistrez les honoraires encaissés</div>
          <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Enregistrer</button>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 90px 90px 90px 100px 80px", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", gap: 10, borderBottom: "1px solid #f3f4f6" }}>
            <span>Libellé</span><span>Type</span><span>Montant HT</span><span>TVA</span><span>TTC</span><span>Mode</span><span>Date</span>
          </div>
          {encaissements.map((e, i) => (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 90px 90px 90px 100px 80px", padding: "11px 16px", gap: 10, alignItems: "center", borderBottom: i < encaissements.length - 1 ? "1px solid #f9fafb" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{e.libelle}</div>
                {e.reference && <div style={{ fontSize: 10, color: "#9ca3af" }}>Réf. {e.reference}</div>}
              </div>
              <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 5, padding: "2px 7px", fontSize: 11 }}>{ENCAISSEMENT_LABELS[e.type]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>{formatEur(e.montantHT)}</span>
              <span style={{ fontSize: 13, color: "#f59e0b" }}>{formatEur(e.montantTTC - e.montantHT)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{formatEur(e.montantTTC)}</span>
              <span style={{ fontSize: 12, color: "#374151" }}>{MODE_LABELS[e.mode]}</span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{e.date}</span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 520, maxHeight: "90vh", background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Enregistrer un encaissement</span>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <F label="Libellé *"><input value={f.libelle} onChange={e => set("libelle", e.target.value)} placeholder="ex. Honoraires vente 12 rue de la Paix" style={{ ...inp, width: "100%" }} /></F>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Type">
                  <select value={f.type} onChange={e => set("type", e.target.value)} style={inp}>
                    {Object.entries(ENCAISSEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </F>
                <F label="Mode de règlement">
                  <select value={f.mode} onChange={e => set("mode", e.target.value)} style={inp}>
                    {MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                  </select>
                </F>
                <F label="Montant HT (€) *"><input type="number" value={f.montantHT} onChange={e => set("montantHT", e.target.value)} placeholder="8000" style={inp} /></F>
                <F label="TVA (%)"><input type="number" value={f.tva} onChange={e => set("tva", e.target.value)} style={inp} /></F>
              </div>

              {/* Calcul auto */}
              {montantHT > 0 && (
                <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>HT</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#059669" }}>{formatEur(montantHT)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>TVA {tvaRate}%</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f59e0b" }}>{formatEur(tvaMontant)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>TTC</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#7c3aed" }}>{formatEur(montantTTC)}</div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Date"><input type="date" value={f.date} onChange={e => set("date", e.target.value)} style={inp} /></F>
                <F label="Référence"><input value={f.reference} onChange={e => set("reference", e.target.value)} placeholder="N° chèque, virement…" style={inp} /></F>
              </div>

              <F label="Transaction liée (optionnel)">
                <select value={f.transactionId} onChange={e => set("transactionId", e.target.value)} style={{ ...inp, width: "100%" }}>
                  <option value="">— Aucune —</option>
                  {transactions.filter(t => !t.encaisse).map(t => (
                    <option key={t.id} value={t.id}>{t.bien} — {t.client} ({t.type})</option>
                  ))}
                </select>
              </F>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Annuler</button>
              <button onClick={submit} disabled={!f.libelle || !montantHT} style={{ ...btnPrimary, opacity: (!f.libelle || !montantHT) ? 0.5 : 1 }}>Enregistrer</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{label}</div>{children}</div>;
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "#374151" };
