"use client";
import { useState } from "react";
import { MailLabel } from "@/lib/mail";

const COLORS = ["#7c3aed","#0891b2","#059669","#dc2626","#d97706","#db2777","#374151","#ea580c","#65a30d"];

export default function LabelManager({ labels, onSave, onClose }: {
  labels: MailLabel[];
  onSave: (l: MailLabel[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<MailLabel[]>(labels);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  function add() {
    if (!newName.trim()) return;
    setList(p => [...p, { id: Date.now().toString(), name: newName.trim(), color: newColor }]);
    setNewName("");
  }

  function remove(id: string) { setList(p => p.filter(l => l.id !== id || l.system)); }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, maxHeight: "80vh", background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Gérer les libellés</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {/* Custom labels */}
          {list.filter(l => !l.system).map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, marginBottom: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{l.name}</span>
              <button onClick={() => remove(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
            </div>
          ))}

          {/* Add new */}
          <div style={{ border: "1px dashed #e5e7eb", borderRadius: 10, padding: 12, marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Nouveau libellé</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Nom du libellé" style={{ flex: 1, height: 34, border: "1px solid #e5e7eb", borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none" }} />
              <button onClick={add} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, padding: "0 14px", fontSize: 12, cursor: "pointer" }}>+</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setNewColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: newColor === c ? "3px solid #fff" : "3px solid transparent", outline: newColor === c ? `2px solid ${c}` : "none", boxSizing: "border-box" }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </>
  );
}
