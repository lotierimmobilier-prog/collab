"use client";
import { useState } from "react";
import { Transaction, Mandataire, TRANSACTION_TYPE, formatEur } from "@/lib/compta";

export default function TransactionsPanel({ transactions, mandataires, onAdd, onEmettreFacture }: {
  transactions: Transaction[];
  mandataires: Mandataire[];
  onAdd: (t: Transaction) => void;
  onEmettreFacture: (id: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [f, setF] = useState({
    type: "vente" as "vente" | "location",
    reference: "", bien: "", adresse: "", client: "",
    mandataireId: "", dateTransaction: "",
    prixVente: "", honorairesAgenceHT: "",
    loyerCC: "", honorairesLocationHT: "",
    notes: "",
  });

  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  function submit() {
    const t: Transaction = {
      id: Date.now().toString(),
      type: f.type,
      reference: f.reference || `TX-${Date.now()}`,
      bien: f.bien, adresse: f.adresse, client: f.client,
      mandataireId: f.mandataireId || undefined,
      dateTransaction: f.dateTransaction || new Date().toLocaleDateString("fr-FR"),
      encaisse: false,
      prixVente: f.type === "vente" ? parseFloat(f.prixVente) || 0 : undefined,
      honorairesAgenceHT: f.type === "vente" ? parseFloat(f.honorairesAgenceHT) || 0 : undefined,
      loyerCC: f.type === "location" ? parseFloat(f.loyerCC) || 0 : undefined,
      honorairesLocationHT: f.type === "location" ? parseFloat(f.honorairesLocationHT) || 0 : undefined,
      notes: f.notes,
    };
    onAdd(t);
    setShowModal(false);
    setF({ type: "vente", reference: "", bien: "", adresse: "", client: "", mandataireId: "", dateTransaction: "", prixVente: "", honorairesAgenceHT: "", loyerCC: "", honorairesLocationHT: "", notes: "" });
  }

  const mandataireOf = (id?: string) => mandataires.find(m => m.id === id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>{transactions.length} transaction(s)</div>
        <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Nouvelle transaction</button>
      </div>

      {transactions.length === 0 ? (
        <Empty onAdd={() => setShowModal(true)} />
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1.5fr 1fr 100px 90px 90px 110px", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", gap: 10, borderBottom: "1px solid #f3f4f6" }}>
            <span>Type</span><span>Référence / Bien</span><span>Client</span><span>Mandataire</span>
            <span>Honoraires HT</span><span>Date</span><span>Encaissé</span><span>Facture</span>
          </div>
          {transactions.map((t, i) => {
            const tt = TRANSACTION_TYPE[t.type];
            const m = mandataireOf(t.mandataireId);
            const hon = t.type === "vente" ? t.honorairesAgenceHT : t.honorairesLocationHT;
            return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1.5fr 1fr 100px 90px 90px 110px", padding: "11px 16px", gap: 10, alignItems: "center", borderBottom: i < transactions.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <span style={{ background: tt.color + "18", color: tt.color, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>{tt.icon} {tt.label}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{t.bien}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{t.reference}</div>
                </div>
                <span style={{ fontSize: 13, color: "#374151" }}>{t.client}</span>
                <span style={{ fontSize: 12, color: m ? "#374151" : "#9ca3af" }}>
                  {m ? `${m.prenom} ${m.nom}` : "—"}
                  {m && <span style={{ display: "block", fontSize: 10, color: "#9ca3af" }}>{m.tauxCommission}%</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>{hon ? formatEur(hon) : "—"}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{t.dateTransaction}</span>
                <span style={{ fontSize: 12 }}>
                  {t.encaisse
                    ? <span style={{ color: "#059669", fontWeight: 600 }}>✓ Oui</span>
                    : <span style={{ color: "#9ca3af" }}>Non</span>}
                </span>
                <div>
                  {t.factureId ? (
                    <span style={{ background: "#f0fdf4", color: "#166534", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>✓ Émise</span>
                  ) : t.mandataireId ? (
                    <button onClick={() => onEmettreFacture(t.id)} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                      Émettre facture
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: "#d1d5db" }}>Pas de mandataire</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 560, maxHeight: "90vh", background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Nouvelle transaction</span>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type */}
              <div style={{ display: "flex", gap: 8 }}>
                {(["vente", "location"] as const).map(type => (
                  <label key={type} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: `1.5px solid ${f.type === type ? TRANSACTION_TYPE[type].color : "#e5e7eb"}`, borderRadius: 8, cursor: "pointer", background: f.type === type ? TRANSACTION_TYPE[type].color + "08" : "#fff" }}>
                    <input type="radio" name="type" checked={f.type === type} onChange={() => set("type", type)} style={{ display: "none" }} />
                    <span style={{ fontSize: 18 }}>{TRANSACTION_TYPE[type].icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: f.type === type ? TRANSACTION_TYPE[type].color : "#374151" }}>{TRANSACTION_TYPE[type].label}</span>
                  </label>
                ))}
              </div>

              <Grid2>
                <F label="Référence"><input value={f.reference} onChange={e => set("reference", e.target.value)} placeholder="Auto-générée si vide" style={inp} /></F>
                <F label="Date"><input type="date" value={f.dateTransaction} onChange={e => set("dateTransaction", e.target.value)} style={inp} /></F>
                <F label="Bien *"><input value={f.bien} onChange={e => set("bien", e.target.value)} placeholder="Désignation du bien" style={{ ...inp, gridColumn: "span 2" }} /></F>
                <F label="Adresse"><input value={f.adresse} onChange={e => set("adresse", e.target.value)} placeholder="Adresse" style={inp} /></F>
                <F label="Client *"><input value={f.client} onChange={e => set("client", e.target.value)} placeholder="Nom du client" style={inp} /></F>
              </Grid2>

              {f.type === "vente" ? (
                <Grid2>
                  <F label="Prix de vente (€)"><input type="number" value={f.prixVente} onChange={e => set("prixVente", e.target.value)} placeholder="250000" style={inp} /></F>
                  <F label="Honoraires agence HT (€)"><input type="number" value={f.honorairesAgenceHT} onChange={e => set("honorairesAgenceHT", e.target.value)} placeholder="8000" style={inp} /></F>
                </Grid2>
              ) : (
                <Grid2>
                  <F label="Loyer CC (€)"><input type="number" value={f.loyerCC} onChange={e => set("loyerCC", e.target.value)} placeholder="800" style={inp} /></F>
                  <F label="Honoraires mise en location HT (€)"><input type="number" value={f.honorairesLocationHT} onChange={e => set("honorairesLocationHT", e.target.value)} placeholder="800" style={inp} /></F>
                </Grid2>
              )}

              <F label="Mandataire (optionnel)">
                <select value={f.mandataireId} onChange={e => set("mandataireId", e.target.value)} style={{ ...inp, width: "100%" }}>
                  <option value="">— Sans mandataire —</option>
                  {mandataires.filter(m => m.actif).map(m => (
                    <option key={m.id} value={m.id}>{m.prenom} {m.nom} ({m.tauxCommission}%)</option>
                  ))}
                </select>
              </F>

              <F label="Notes">
                <textarea value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes internes…" rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none", width: "100%" }} />
              </F>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Annuler</button>
              <button onClick={submit} disabled={!f.bien || !f.client} style={{ ...btnPrimary, opacity: (!f.bien || !f.client) ? 0.5 : 1 }}>Enregistrer</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "50px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🏡</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Aucune transaction</div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Enregistrez votre première vente ou mise en location</div>
      <button onClick={onAdd} style={btnPrimary}>+ Nouvelle transaction</button>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{label}</div>{children}</div>;
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "#374151" };
