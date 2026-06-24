"use client";
import { useState } from "react";
import { Task, Priority, Status, PRIORITY_STYLES, COLUMNS } from "@/lib/tasks";

const MEMBERS = [
  { initials: "JL", name: "Jérôme L.", color: "#F7F0E6" },
  { initials: "MD", name: "Marie D.", color: "#dcfce7" },
  { initials: "PR", name: "Paul R.", color: "#dbeafe" },
];

export default function NewTaskModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("moyenne");
  const [status, setStatus] = useState<Status>("todo");
  const [assignee, setAssignee] = useState(MEMBERS[0]);
  const [dueDate, setDueDate] = useState("");
  const [project, setProject] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  }

  function submit() {
    if (!title.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: title.trim(),
      status,
      priority,
      assignee: assignee.name,
      assigneeInitials: assignee.initials,
      assigneeColor: assignee.color,
      dueDate: dueDate || undefined,
      tags: tags.length ? tags : undefined,
      project: project || undefined,
      comments: 0,
      attachments: 0,
    };
    onAdd(task);
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40,
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 520, background: "#fff", borderRadius: 14, zIndex: 50,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>Nouvelle tâche</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <FieldLabel>Titre *</FieldLabel>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="Nom de la tâche…"
              style={inputStyle}
            />
          </div>

          {/* Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Statut</FieldLabel>
              <select value={status} onChange={e => setStatus(e.target.value as Status)} style={inputStyle}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Priorité</FieldLabel>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={inputStyle}>
                {(Object.entries(PRIORITY_STYLES) as [Priority, typeof PRIORITY_STYLES[Priority]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Assigné à</FieldLabel>
              <select
                value={assignee.initials}
                onChange={e => setAssignee(MEMBERS.find(m => m.initials === e.target.value)!)}
                style={inputStyle}
              >
                {MEMBERS.map(m => <option key={m.initials} value={m.initials}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Échéance</FieldLabel>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Project */}
          <div>
            <FieldLabel>Projet</FieldLabel>
            <input
              value={project}
              onChange={e => setProject(e.target.value)}
              placeholder="ex. Gestion locative"
              style={inputStyle}
            />
          </div>

          {/* Tags */}
          <div>
            <FieldLabel>Étiquettes (Entrée pour ajouter)</FieldLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  background: "#f3f4f6", color: "#374151", borderRadius: 6,
                  padding: "3px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                }}>
                  {tag}
                  <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder="Ajouter une étiquette…"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid #e5e7eb",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#374151",
          }}>Annuler</button>
          <button onClick={submit} disabled={!title.trim()} style={{
            background: title.trim() ? "#B8966A" : "#e5e7eb",
            color: title.trim() ? "#fff" : "#9ca3af",
            border: "none", borderRadius: 8, padding: "8px 18px",
            fontSize: 13, fontWeight: 500, cursor: title.trim() ? "pointer" : "default",
          }}>Créer la tâche</button>
        </div>
      </div>
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb",
  fontFamily: "inherit", boxSizing: "border-box",
};
