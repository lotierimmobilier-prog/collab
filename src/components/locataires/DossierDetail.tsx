"use client";
import { useState } from "react";
import { Dossier, STATUS_STYLES, DOCUMENT_LIST, DossierStatus, calcTauxEndettement, gliEligible } from "@/lib/locataires";
import { generateDossierPDF } from "@/lib/generatePdf";

export default function DossierDetail({ dossier, onClose, onUpdate }: {
  dossier: Dossier;
  onClose: () => void;
  onUpdate: (d: Dossier) => void;
}) {
  const [tab, setTab] = useState<"apercu" | "pieces" | "gli" | "notes">("apercu");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const taux = calcTauxEndettement(dossier.loyerCC, dossier.revenus);
  const gli = gliEligible(taux, dossier.revenus, dossier.loyerCC);
  const s = STATUS_STYLES[dossier.status];
  const uploadedCount = dossier.uploads.filter(u => u.files.length > 0).length;

  async function downloadPDF() {
    setGeneratingPdf(true);
    try {
      const bytes = await generateDossierPDF({
        nom: dossier.nom, prenom: dossier.prenom,
        email: dossier.email, telephone: dossier.telephone,
        typeContrat: dossier.typeContrat, employeur: dossier.employeur,
        revenus: dossier.revenus, loyerCC: dossier.loyerCC,
        situation: dossier.situationLogement,
        taux, gliOk: gli.ok, gliMsg: gli.msg,
        uploads: dossier.uploads,
        docs: DOCUMENT_LIST,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier-${dossier.nom}-${dossier.prenom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingPdf(false);
    }
  }

  const groups = [...new Set(DOCUMENT_LIST.map(d => d.group))];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 540, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{dossier.prenom} {dossier.nom}</h2>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{dossier.email}{dossier.telephone ? ` · ${dossier.telephone}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={downloadPDF} disabled={generatingPdf} style={{ background: "#F7F0E6", color: "#B8966A", border: "1px solid #E8D9C0", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                {generatingPdf ? "..." : "PDF"}
              </button>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>x</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, height: 6 }}>
              <div style={{ width: `${Math.min(100, uploadedCount * 10)}%`, height: "100%", background: "#B8966A", borderRadius: 8 }} />
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{uploadedCount} doc(s)</span>
            <select value={dossier.status} onChange={e => onUpdate({ ...dossier, status: e.target.value as DossierStatus })}
              style={{ border: `1px solid ${s.text}40`, borderRadius: 6, padding: "4px 8px", fontSize: 12, background: s.bg, color: s.text, fontWeight: 500 }}>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "0 20px" }}>
          {(["apercu", "pieces", "gli", "notes"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "10px 14px", fontSize: 13,
              fontWeight: tab === t ? 500 : 400, color: tab === t ? "#B8966A" : "#6b7280",
              borderBottom: tab === t ? "2px solid #B8966A" : "2px solid transparent",
            }}>{{ apercu: "Apercu", pieces: "Pieces", gli: "GLI", notes: "Notes" }[t]}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {tab === "apercu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <InfoBlock title="Bien"><Row label="Bien">{dossier.bien || "—"}</Row><Row label="Loyer CC">{dossier.loyerCC ? `${dossier.loyerCC.toLocaleString("fr-FR")} EUR` : "—"}</Row></InfoBlock>
              <InfoBlock title="Situation professionnelle">
                <Row label="Contrat">{dossier.typeContrat}</Row>
                <Row label="Employeur">{dossier.employeur || "—"}</Row>
                <Row label="Revenus nets">{dossier.revenus ? `${dossier.revenus.toLocaleString("fr-FR")} EUR/mois` : "—"}</Row>
                <Row label="Logement actuel">{dossier.situationLogement}</Row>
              </InfoBlock>
              <div style={{ background: gli.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${gli.ok ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: gli.ok ? "#166534" : "#991b1b" }}>{gli.ok ? "OK" : "NON"} {gli.msg}</div>
              </div>
            </div>
          )}

          {tab === "pieces" && (
            <div>
              {groups.map(group => (
                <div key={group} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{group}</div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                    {DOCUMENT_LIST.filter(d => d.group === group).map((doc, i, arr) => {
                      const upload = dossier.uploads.find(u => u.docId === doc.id);
                      const count = upload?.files.length ?? 0;
                      return (
                        <div key={doc.id} style={{ padding: "10px 14px", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{count > 0 ? "OK" : doc.required ? "[ ]" : "-"}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{doc.label}{doc.required && <span style={{ color: "#ef4444" }}> *</span>}</div>
                            {count > 0 && <div style={{ fontSize: 11, color: "#059669" }}>{count} fichier(s)</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "gli" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: gli.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${gli.ok ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "14px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: gli.ok ? "#166534" : "#991b1b" }}>{gli.ok ? "Eligible GLI" : "Non eligible GLI"}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{gli.msg}</div>
              </div>
              <InfoBlock title="Calcul">
                <Row label="Loyer CC">{dossier.loyerCC ? `${dossier.loyerCC.toLocaleString("fr-FR")} EUR` : "—"}</Row>
                <Row label="Revenus nets">{dossier.revenus ? `${dossier.revenus.toLocaleString("fr-FR")} EUR` : "—"}</Row>
                <Row label="Taux endettement">{taux > 0 ? `${taux}%` : "—"}</Row>
                <Row label="Revenu min requis">{dossier.loyerCC ? `${(dossier.loyerCC * 3).toLocaleString("fr-FR")} EUR` : "—"}</Row>
                <Row label="Critere <= 33%">{taux > 0 ? (taux <= 33 ? "OK" : "Depasse") : "—"}</Row>
                <Row label="Critere revenus >= 3x">{dossier.revenus >= dossier.loyerCC * 3 ? "OK" : "Insuffisant"}</Row>
              </InfoBlock>
            </div>
          )}

          {tab === "notes" && (
            <textarea defaultValue={dossier.notes} onBlur={e => onUpdate({ ...dossier, notes: e.target.value })} placeholder="Notes internes..." style={{ width: "100%", minHeight: 200, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          )}
        </div>
      </div>
    </>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div><div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>{children}</div></div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #f9fafb" }}><span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span><span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{children}</span></div>;
}
