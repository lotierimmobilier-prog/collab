"use client";
import { useState } from "react";
import { Mandataire, Facture, FACTURE_STATUS, formatEur } from "@/lib/compta";

export default function MandatairesPanel({ mandataires, factures, onAdd, onUpdate }: {
  mandataires: Mandataire[];
  factures: Facture[];
  onAdd: (m: Mandataire) => void;
  onUpdate: (m: Mandataire) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Mandataire | null>(null);
  const [selected, setSelected] = useState<Mandataire | null>(null);

  const mandataireFactures = (id: string) => factures.filter(f => f.mandataireId === id);
  const totalComm = (id: string) => mandataireFactures(id).filter(f => f.status !== "annulee").reduce((s, f) => s + f.commissionTTC, 0);
  const paye = (id: string) => mandataireFactures(id).filter(f => f.status === "payee").reduce((s, f) => s + f.commissionTTC, 0);

  function openNew() { setEditing(null); setShowModal(true); }
  function openEdit(m: Mandataire) { setEditing(m); setShowModal(true); }

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Liste */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, color: "#6b7280" }}>{mandataires.length} mandataire(s)</div>
          <button onClick={openNew} style={btnPrimary}>+ Nouveau mandataire</button>
        </div>

        {mandataires.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "50px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Aucun mandataire</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Créez vos agents commerciaux mandataires</div>
            <button onClick={openNew} style={btnPrimary}>+ Créer un mandataire</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mandataires.map(m => {
              const nb = mandataireFactures(m.id).length;
              const total = totalComm(m.id);
              const paid = paye(m.id);
              const isSelected = selected?.id === m.id;
              return (
                <div key={m.id} onClick={() => setSelected(isSelected ? null : m)} style={{
                  background: "#fff", borderRadius: 12,
                  border: `1.5px solid ${isSelected ? "#B8966A" : "#e5e7eb"}`,
                  padding: "14px 16px", cursor: "pointer",
                  boxShadow: isSelected ? "0 0 0 3px #F7F0E6" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#B8966A", flexShrink: 0 }}>
                      {m.prenom.charAt(0)}{m.nom.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{m.prenom} {m.nom}</span>
                        <span style={{ background: m.actif ? "#f0fdf4" : "#f3f4f6", color: m.actif ? "#166534" : "#6b7280", borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>
                          {m.actif ? "Actif" : "Inactif"}
                        </span>
                        <span style={{ background: "#F7F0E6", color: "#B8966A", borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                          {m.tauxCommission}%
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{m.email}</div>
                      {m.siret && <div style={{ fontSize: 11, color: "#9ca3af" }}>SIRET : {m.siret}</div>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); openEdit(m); }} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#374151" }}>✏ Modifier</button>
                  </div>

                  {/* Stats commissions */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                    <Stat label="Factures" value={String(nb)} />
                    <Stat label="Total commissions TTC" value={formatEur(total)} color="#B8966A" />
                    <Stat label="Payé TTC" value={formatEur(paid)} color="#059669" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Détail mandataire */}
      {selected && (
        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", position: "sticky", top: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Espace mandataire</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
            </div>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#B8966A", margin: "0 auto 8px" }}>
                {selected.prenom.charAt(0)}{selected.nom.charAt(0)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{selected.prenom} {selected.nom}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Agent commercial · {selected.tauxCommission}% de commission</div>
            </div>

            {/* Tableau récap auto-facturation */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Auto-facturation</div>
            {mandataireFactures(selected.id).length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: "#d1d5db" }}>Aucune facture</div>
            ) : (
              mandataireFactures(selected.id).map(f => {
                const s = FACTURE_STATUS[f.status];
                return (
                  <div key={f.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#B8966A", fontFamily: "monospace" }}>{f.numero}</span>
                      <span style={{ background: s.bg, color: s.text, borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
                      <span>Honoraires agence HT</span>
                      <span>{formatEur(f.honorairesAgenceHT)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
                      <span>Commission {f.tauxCommission}% HT</span>
                      <span style={{ color: "#B8966A", fontWeight: 600 }}>{formatEur(f.commissionHT)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
                      <span>TVA 20%</span>
                      <span>{formatEur(f.tva)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, borderTop: "1px solid #f3f4f6", paddingTop: 4, marginTop: 4 }}>
                      <span>Total TTC</span>
                      <span style={{ color: "#111827" }}>{formatEur(f.commissionTTC)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Émise le {f.dateEmission}</div>
                  </div>
                );
              })
            )}

            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: "#6b7280" }}>Total à reverser TTC</span>
                <span style={{ color: "#B8966A" }}>{formatEur(totalComm(selected.id))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                <span style={{ color: "#9ca3af" }}>Déjà payé TTC</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>{formatEur(paye(selected.id))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                <span style={{ color: "#9ca3af" }}>Reste à payer TTC</span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{formatEur(totalComm(selected.id) - paye(selected.id))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && <MandataireModal mandataire={editing} onClose={() => setShowModal(false)} onSave={m => { editing ? onUpdate(m) : onAdd(m); setShowModal(false); }} />}
    </div>
  );
}

function MandataireModal({ mandataire, onClose, onSave }: { mandataire: Mandataire | null; onClose: () => void; onSave: (m: Mandataire) => void }) {
  const [f, setF] = useState({ prenom: mandataire?.prenom ?? "", nom: mandataire?.nom ?? "", email: mandataire?.email ?? "", telephone: mandataire?.telephone ?? "", siret: mandataire?.siret ?? "", tauxCommission: String(mandataire?.tauxCommission ?? 70), actif: mandataire?.actif ?? true });
  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }
  function submit() {
    onSave({ id: mandataire?.id ?? Date.now().toString(), prenom: f.prenom, nom: f.nom, email: f.email, telephone: f.telephone || undefined, siret: f.siret || undefined, tauxCommission: parseFloat(f.tauxCommission) || 70, actif: f.actif, createdAt: mandataire?.createdAt ?? new Date().toLocaleDateString("fr-FR") });
  }
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 460, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{mandataire ? "Modifier" : "Nouveau"} mandataire</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Prénom *"><input value={f.prenom} onChange={e => set("prenom", e.target.value)} style={inp} /></F>
            <F label="Nom *"><input value={f.nom} onChange={e => set("nom", e.target.value)} style={inp} /></F>
            <F label="Email *"><input type="email" value={f.email} onChange={e => set("email", e.target.value)} style={inp} /></F>
            <F label="Téléphone"><input value={f.telephone} onChange={e => set("telephone", e.target.value)} style={inp} /></F>
            <F label="SIRET"><input value={f.siret} onChange={e => set("siret", e.target.value)} placeholder="XXX XXX XXX XXXXX" style={inp} /></F>
            <F label="Taux de commission (%)">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min="0" max="100" value={f.tauxCommission} onChange={e => set("tauxCommission", e.target.value)} style={{ ...inp, flex: 1 }} />
                <span style={{ fontSize: 13, color: "#B8966A", fontWeight: 700 }}>{f.tauxCommission}%</span>
              </div>
            </F>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div onClick={() => set("actif", !f.actif)} style={{ width: 38, height: 20, borderRadius: 10, background: f.actif ? "#B8966A" : "#e5e7eb", position: "relative", cursor: "pointer", transition: "background .2s" }}>
              <div style={{ position: "absolute", top: 2, left: f.actif ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </div>
            <span style={{ fontSize: 13 }}>Mandataire {f.actif ? "actif" : "inactif"}</span>
          </label>
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={btnSecondary}>Annuler</button>
          <button onClick={submit} disabled={!f.prenom || !f.nom || !f.email} style={{ ...btnPrimary, opacity: (!f.prenom || !f.nom || !f.email) ? 0.5 : 1 }}>
            {mandataire ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 700, color: color ?? "#111827" }}>{value}</div><div style={{ fontSize: 10, color: "#9ca3af" }}>{label}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "#374151" };
