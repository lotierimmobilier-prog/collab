"use client";
import RichTextEditor from "./RichTextEditor";

interface Props {
  value: string;
  onChange: (html: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";

export default function SignatureEditor({ value, onChange, onSave, onCancel }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Cordialement,&#10;Votre nom · Lotier Immobilier · 01 23 45 67 89"
        minHeight={90}
        maxHeight={200}
        showHtmlToggle
        compact
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sauvegarder</button>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>Annuler</button>
        <button onClick={() => onChange("")} style={{ background: "none", border: "1px solid #fecaca", borderRadius: 7, padding: "7px 10px", fontSize: 11, cursor: "pointer", color: "#ef4444", marginLeft: "auto" }}>Effacer</button>
      </div>
    </div>
  );
}
