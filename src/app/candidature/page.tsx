"use client";
import { useState } from "react";
import {
  DOCUMENT_LIST, SITUATION_LABELS, UploadedFile,
  calcTauxEndettement, gliEligible,
} from "@/lib/locataires";
import { generateDossierPDF } from "@/lib/generatePdf";

const CONTRATS = ["CDI", "CDD", "Intérim", "Indépendant / Freelance", "Étudiant", "Retraité", "Sans emploi"];
type Situation = "locataire" | "proprietaire" | "heberge" | "autre";

const STEPS = [
  { n: 1, label: "Identité" },
  { n: 2, label: "Situation" },
  { n: 3, label: "Documents" },
  { n: 4, label: "Récapitulatif" },
];

export default function CandidaturePage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", telephone: "",
    typeContrat: "CDI", employeur: "", revenus: "",
    loyerRef: "",
    situation: "locataire" as Situation,
  });
  const [uploads, setUploads] = useState<UploadedFile[]>([]);

  const loyerCC = parseFloat(form.loyerRef) || 0;
  const revenus = parseFloat(form.revenus) || 0;
  const taux = calcTauxEndettement(loyerCC, revenus);
  const gli = gliEligible(taux, revenus, loyerCC);

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  function getUpload(docId: string) {
    return uploads.find(u => u.docId === docId);
  }

  async function handleFileChange(docId: string, files: FileList | null, multiple = false) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const processed = await Promise.all(fileArray.map(file => new Promise<{ name: string; size: number; dataUrl: string; type: string }>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        name: file.name,
        size: file.size,
        dataUrl: e.target?.result as string,
        type: file.type,
      });
      reader.readAsDataURL(file);
    })));

    setUploads(prev => {
      const existing = prev.find(u => u.docId === docId);
      if (existing) {
        return prev.map(u => u.docId === docId
          ? { ...u, files: multiple ? [...u.files, ...processed] : processed }
          : u
        );
      }
      return [...prev, { docId, files: processed }];
    });
  }

  function removeFile(docId: string, idx: number) {
    setUploads(prev => prev.map(u => u.docId === docId
      ? { ...u, files: u.files.filter((_, i) => i !== idx) }
      : u
    ).filter(u => u.files.length > 0));
  }

  const requiredDocs = DOCUMENT_LIST.filter(d => d.required);
  const uploadedRequired = requiredDocs.filter(d => getUpload(d.id)?.files.length);
  const step3Valid = uploadedRequired.length === requiredDocs.length;
  const step1Valid = !!(form.prenom && form.nom && form.email);
  const step2Valid = !!(form.typeContrat && form.revenus);

  // Docs à afficher selon situation
  const visibleDocs = DOCUMENT_LIST.filter(d => {
    if (!d.condition) return true;
    return d.condition === form.situation;
  });

  const groups = [...new Set(visibleDocs.map(d => d.group))];

  async function handleDownloadPDF() {
    setGeneratingPdf(true);
    try {
      const pdfBytes = await generateDossierPDF({
        nom: form.nom, prenom: form.prenom,
        email: form.email, telephone: form.telephone,
        typeContrat: form.typeContrat, employeur: form.employeur,
        revenus, loyerCC, situation: form.situation,
        taux, gliOk: gli.ok, gliMsg: gli.msg,
        uploads,
        docs: DOCUMENT_LIST,
      });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier-${form.nom}-${form.prenom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Dossier envoyé !</h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
            Votre dossier a bien été transmis. Nous reviendrons vers vous à <strong>{form.email}</strong>.
          </p>
          {gli.ok && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 20 }}>
              ✅ {gli.msg}
            </div>
          )}
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPdf}
            style={{ ...btnPrimary, marginBottom: 10, opacity: generatingPdf ? 0.7 : 1 }}
          >
            {generatingPdf ? "Génération en cours…" : "📄 Télécharger mon dossier PDF"}
          </button>
          <br />
          <button
            onClick={() => { setSubmitted(false); setStep(1); setUploads([]); setForm({ nom: "", prenom: "", email: "", telephone: "", typeContrat: "CDI", employeur: "", revenus: "", loyerRef: "", situation: "locataire" }); }}
            style={btnSecondary}
          >Nouveau dossier</button>
        </div>
      </PageShell>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ff", padding: "32px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            Collab<span style={{ color: "#7c3aed" }}>.</span> — Dépôt de dossier
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Constituez votre dossier de candidature locative en ligne</div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                  background: step > s.n ? "#7c3aed" : step === s.n ? "#7c3aed" : "#e5e7eb",
                  color: step >= s.n ? "#fff" : "#9ca3af",
                }}>{step > s.n ? "✓" : s.n}</div>
                <span style={{ fontSize: 12, color: step >= s.n ? "#7c3aed" : "#9ca3af", fontWeight: step === s.n ? 600 : 400 }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: step > s.n ? "#7c3aed" : "#e5e7eb", margin: "0 8px" }} />}
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "28px 28px 8px" }}>

            {/* STEP 1 */}
            {step === 1 && (
              <div>
                <SectionTitle>Vos informations personnelles</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Prénom *"><input value={form.prenom} onChange={e => set("prenom", e.target.value)} placeholder="Jean" style={inputStyle} /></Field>
                  <Field label="Nom *"><input value={form.nom} onChange={e => set("nom", e.target.value)} placeholder="Dupont" style={inputStyle} /></Field>
                  <Field label="Email *"><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jean.dupont@email.fr" style={inputStyle} /></Field>
                  <Field label="Téléphone"><input value={form.telephone} onChange={e => set("telephone", e.target.value)} placeholder="06 00 00 00 00" style={inputStyle} /></Field>
                  <Field label="Loyer du bien visé CC (€)"><input type="number" value={form.loyerRef} onChange={e => set("loyerRef", e.target.value)} placeholder="800" style={inputStyle} /></Field>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div>
                <SectionTitle>Situation professionnelle & domicile</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <Field label="Type de contrat *">
                    <select value={form.typeContrat} onChange={e => set("typeContrat", e.target.value)} style={inputStyle}>
                      {CONTRATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Revenus nets / mois (€) *">
                    <input type="number" value={form.revenus} onChange={e => set("revenus", e.target.value)} placeholder="2500" style={inputStyle} />
                  </Field>
                  <Field label="Employeur">
                    <input value={form.employeur} onChange={e => set("employeur", e.target.value)} placeholder="Nom de l'employeur" style={inputStyle} />
                  </Field>
                  <Field label="Situation de logement actuelle">
                    <select value={form.situation} onChange={e => set("situation", e.target.value)} style={inputStyle}>
                      {Object.entries(SITUATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>

                {loyerCC > 0 && revenus > 0 && (
                  <div style={{
                    background: gli.ok ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${gli.ok ? "#bbf7d0" : "#fecaca"}`,
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: gli.ok ? "#166534" : "#991b1b", marginBottom: 4 }}>
                      {gli.ok ? "✅" : "⚠️"} {gli.msg}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Minimum requis : <strong>{(loyerCC * 3).toLocaleString("fr-FR")} € / mois</strong> · Taux : <strong>{taux}%</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div>
                <SectionTitle>Pièces justificatives</SectionTitle>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
                  Les pièces marquées <span style={{ color: "#ef4444" }}>*</span> sont obligatoires.
                  Formats : PDF, JPG, PNG. Max 10 Mo par fichier.
                </p>

                {/* Progress */}
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3 }}>
                      <div style={{
                        width: `${Math.round((uploadedRequired.length / requiredDocs.length) * 100)}%`,
                        height: "100%", background: step3Valid ? "#10b981" : "#7c3aed", borderRadius: 3, transition: "width .3s",
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                    {uploadedRequired.length}/{requiredDocs.length} obligatoires
                  </span>
                </div>

                {groups.map(group => (
                  <div key={group} style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                      {group}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {visibleDocs.filter(d => d.group === group).map(doc => {
                        const upload = getUpload(doc.id);
                        const hasFiles = (upload?.files.length ?? 0) > 0;
                        return (
                          <div key={doc.id} style={{
                            border: `1px solid ${hasFiles ? "#bbf7d0" : "#e5e7eb"}`,
                            borderRadius: 10, background: hasFiles ? "#f0fdf4" : "#f9fafb",
                            overflow: "hidden",
                          }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
                              <span style={{ fontSize: 18, flexShrink: 0 }}>{hasFiles ? "✅" : "📎"}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                                  {doc.label}
                                  {doc.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{doc.description}</div>
                              </div>
                              <input
                                type="file"
                                accept={doc.accept}
                                multiple={doc.multiple}
                                style={{ display: "none" }}
                                onChange={e => handleFileChange(doc.id, e.target.files, doc.multiple)}
                              />
                              <span style={{
                                fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6,
                                padding: "5px 12px", background: "#fff", color: "#374151", whiteSpace: "nowrap",
                              }}>
                                {hasFiles ? "Ajouter" : "Choisir un fichier"}
                              </span>
                            </label>

                            {/* Uploaded files list */}
                            {upload?.files.map((f, i) => (
                              <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "6px 14px 6px 42px", borderTop: "1px solid #dcfce7",
                                background: "#f0fdf4",
                              }}>
                                <span style={{ fontSize: 12, color: "#059669", flex: 1 }}>
                                  📄 {f.name} <span style={{ color: "#9ca3af" }}>({Math.round(f.size / 1024)} Ko)</span>
                                </span>
                                <button
                                  onClick={() => removeFile(doc.id, i)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1 }}
                                >×</button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 4 — Récapitulatif */}
            {step === 4 && (
              <div>
                <SectionTitle>Récapitulatif avant envoi</SectionTitle>

                <RecapBlock title="Identité">
                  <RecapRow label="Nom">{form.prenom} {form.nom}</RecapRow>
                  <RecapRow label="Email">{form.email}</RecapRow>
                  {form.telephone && <RecapRow label="Téléphone">{form.telephone}</RecapRow>}
                  {loyerCC > 0 && <RecapRow label="Loyer CC visé">{loyerCC.toLocaleString("fr-FR")} €</RecapRow>}
                </RecapBlock>

                <RecapBlock title="Situation">
                  <RecapRow label="Contrat">{form.typeContrat}</RecapRow>
                  {form.employeur && <RecapRow label="Employeur">{form.employeur}</RecapRow>}
                  <RecapRow label="Revenus nets">{revenus > 0 ? `${revenus.toLocaleString("fr-FR")} €/mois` : "—"}</RecapRow>
                  <RecapRow label="Logement actuel">{SITUATION_LABELS[form.situation]}</RecapRow>
                </RecapBlock>

                {loyerCC > 0 && revenus > 0 && (
                  <div style={{
                    background: gli.ok ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${gli.ok ? "#bbf7d0" : "#fecaca"}`,
                    borderRadius: 10, padding: "12px 14px", marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: gli.ok ? "#166534" : "#991b1b" }}>
                      {gli.ok ? "✅" : "❌"} {gli.msg}
                    </div>
                  </div>
                )}

                <RecapBlock title="Documents fournis">
                  {DOCUMENT_LIST.filter(d => getUpload(d.id)?.files.length).map(doc => (
                    <RecapRow key={doc.id} label={doc.label}>
                      {getUpload(doc.id)!.files.length} fichier(s)
                    </RecapRow>
                  ))}
                  {uploads.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", padding: "4px 0" }}>Aucun document fourni</div>}
                </RecapBlock>

                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginTop: 16 }}>
                  En envoyant ce dossier, vous confirmez que toutes les informations fournies sont exactes. Vos documents seront compilés en un PDF sécurisé.
                </p>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div style={{
            display: "flex", justifyContent: "space-between", padding: "16px 28px 24px",
            borderTop: "1px solid #f3f4f6", marginTop: 20,
          }}>
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              style={{ ...btnSecondary, opacity: step === 1 ? 0.4 : 1, cursor: step === 1 ? "default" : "pointer" }}
            >← Précédent</button>

            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : false}
                style={{
                  ...btnPrimary,
                  opacity: (step === 1 ? step1Valid : step === 2 ? step2Valid : true) ? 1 : 0.5,
                }}
              >Suivant →</button>
            ) : (
              <button
                onClick={() => setSubmitted(true)}
                style={btnPrimary}
              >
                📤 Envoyer mon dossier
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Données transmises de façon sécurisée · Utilisées uniquement pour l'étude de votre candidature
        </p>
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", maxWidth: 500, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        {children}
      </div>
    </div>
  );
}

function RecapBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{title}</div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function RecapRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f9fafb", fontSize: 13 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>{children}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 16 }}>{children}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb",
  fontFamily: "inherit", boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
  padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "9px 18px", fontSize: 13, cursor: "pointer", color: "#374151",
};
