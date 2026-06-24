"use client";
import { useState } from "react";
import { Task, COLUMNS, PRIORITY_STYLES, Status } from "@/lib/tasks";

export default function TaskDetail({ task, onClose, onStatusChange }: {
  task: Task;
  onClose: () => void;
  onStatusChange: (s: Status) => void;
}) {
  const [comment, setComment] = useState("");
  const p = PRIORITY_STYLES[task.priority];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40,
      }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "#fff", zIndex: 50, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <span style={{
              background: p.bg, color: p.text, borderRadius: 6,
              padding: "2px 8px", fontSize: 11, fontWeight: 600,
            }}>{p.label}</span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: "#9ca3af", lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Title */}
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 16, lineHeight: 1.4 }}>
            {task.title}
          </h1>

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <MetaField label="Statut">
              <select
                value={task.status}
                onChange={e => onStatusChange(e.target.value as Status)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, background: "#f9fafb" }}
              >
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </MetaField>
            <MetaField label="Priorité">
              <span style={{ background: p.bg, color: p.text, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 500 }}>
                {p.label}
              </span>
            </MetaField>
            <MetaField label="Assigné à">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: task.assigneeColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "#374151",
                }}>{task.assigneeInitials}</div>
                <span style={{ fontSize: 12, color: "#374151" }}>{task.assignee}</span>
              </div>
            </MetaField>
            <MetaField label="Échéance">
              <span style={{ fontSize: 12, color: "#374151" }}>📅 {task.dueDate ?? "—"}</span>
            </MetaField>
            <MetaField label="Projet">
              <span style={{ fontSize: 12, color: "#374151" }}>📁 {task.project ?? "—"}</span>
            </MetaField>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Label>Étiquettes</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {task.tags.map(tag => (
                  <span key={tag} style={{
                    background: "#f3f4f6", color: "#374151", borderRadius: 6,
                    padding: "3px 10px", fontSize: 12,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Label>Sous-tâches ({task.subtasks.filter(s => s.done).length}/{task.subtasks.length})</Label>
              <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                {task.subtasks.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    borderBottom: i < task.subtasks!.length - 1 ? "1px solid #f3f4f6" : "none",
                    background: s.done ? "#f9fafb" : "#fff",
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: s.done ? "none" : "1.5px solid #d1d5db",
                      background: s.done ? "#10b981" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, color: "#fff",
                    }}>{s.done ? "✓" : ""}</div>
                    <span style={{
                      fontSize: 13, color: s.done ? "#9ca3af" : "#374151",
                      textDecoration: s.done ? "line-through" : "none",
                    }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comment box */}
          <div style={{ marginBottom: 16 }}>
            <Label>Commentaires</Label>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", background: "#F7F0E6",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#B8966A", flexShrink: 0,
              }}>JL</div>
              <div style={{ flex: 1 }}>
                <textarea
                  placeholder="Ajouter un commentaire…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", border: "1px solid #e5e7eb", borderRadius: 8,
                    padding: "8px 10px", fontSize: 13, resize: "none", outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                {comment && (
                  <button
                    onClick={() => setComment("")}
                    style={{
                      marginTop: 6, background: "#B8966A", color: "#fff",
                      border: "none", borderRadius: 6, padding: "6px 14px",
                      fontSize: 12, cursor: "pointer",
                    }}
                  >Envoyer</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</div>;
}
