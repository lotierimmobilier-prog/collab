"use client";
import { useState } from "react";
import { DocConfig, DocCategory, CATEGORY_LABELS } from "@/lib/locataires";

export default function DocConfigPanel({ docs, onClose, onSave }: {
  docs: DocConfig[];
  onClose: () => void;
  onSave: (docs: DocConfig[]) => void;
}) {
  const [local, setLocal] = useState<DocConfig[]>(docs);
  const [newLabel, setNewLabel] = useState("");
  const [newCat, setNewCat] = useState<DocCategory>("revenus");
  const [newDesc, setNewDesc] = useState("");

  function toggle(id: string, field: "required") {
    setLocal(prev => prev.map(d => d.id === id ? { ...d, [field]: !d[field] } : d));
  }

  function remove(id: string) {
    setLocal(prev => prev.filter(d => d.id !== id));
  }

  function addDoc() {
    if (!newLabel.trim()) return;
    const doc: DocConfig = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      category: newCat,
      required: true,
      description: newDesc.trim() || undefined,
    };
    setLocal(prev => [...prev, doc]);
    setNewLabel(""); setNewDesc("");
  }

  const categories = Object.keys(CATEGORY_LABELS) as DocCategory[];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 580, maxHeight: "85vh", background: "#fff", borderRadius: 14, zIndex: 50,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>⚙ Pièces requises</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Configurer les documents demandés aux candidats</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {categories.map(cat => {
            const catDocs = local.filter(d => d.category === cat);
            if (!catDocs.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  {catDocs.map((doc, i) => (
                    <div key={doc.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      borderBottom: i < catDocs.length - 1 ? "1px solid #f9fafb" : "none",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{doc.label}</div>
                        {doc.description && <div style={{ fontSize: 11, color: "#9ca3af" }}>{doc.description}</div>}
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12, color: "#374151" }}>
                        <input
                          type="checkbox"
                          checked={doc.required}
                          onChange={() => toggle(doc.id, "required")}
                        />
                        Obligatoire
                      </label>
                      <button
                        onClick={() => remove(doc.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add new */}
          <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 10, padding: "14px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>+ Ajouter une pièce</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Nom du document *"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                style={inputStyle}
              />
              <select value={newCat} onChange={e => setNewCat(e.target.value as DocCategory)} style={inputStyle}>
                {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Description (optionnel)"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addDoc} style={{
                background: "#7c3aed", color: "#fff", border: "none",
                borderRadius: 8, padding: "0 14px", fontSize: 13, cursor: "pointer",
              }}>Ajouter</button>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={() => { onSave(local); onClose(); }} style={{
            background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Enregistrer</button>
        </div>
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  height: 34, border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "0 10px", fontSize: 13, outline: "none", background: "#fff",
  fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};
