"use client";
import { Task, PRIORITY_STYLES } from "@/lib/tasks";

export default function TaskCard({ task, onDragStart, onClick }: {
  task: Task;
  onDragStart: () => void;
  onClick: () => void;
}) {
  const p = PRIORITY_STYLES[task.priority];
  const doneSubs = task.subtasks?.filter(s => s.done).length ?? 0;
  const totalSubs = task.subtasks?.length ?? 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb",
        padding: "12px", marginBottom: 8, cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "box-shadow .15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)")}
    >
      {/* Priority + tags */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{
          background: p.bg, color: p.text, borderRadius: 5,
          padding: "2px 7px", fontSize: 10, fontWeight: 600,
        }}>{p.label}</span>
        {task.tags?.map(tag => (
          <span key={tag} style={{
            background: "#f3f4f6", color: "#6b7280", borderRadius: 5,
            padding: "2px 7px", fontSize: 10,
          }}>{tag}</span>
        ))}
      </div>

      {/* Title */}
      <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 6, lineHeight: 1.4 }}>
        {task.title}
      </p>

      {/* Project */}
      {task.project && (
        <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>📁 {task.project}</p>
      )}

      {/* Subtasks progress */}
      {totalSubs > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>Sous-tâches</span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>{doneSubs}/{totalSubs}</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2 }}>
            <div style={{
              width: `${Math.round((doneSubs / totalSubs) * 100)}%`,
              height: "100%", background: "#B8966A", borderRadius: 2,
            }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {task.assigneeInitials && (
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: task.assigneeColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "#374151",
          }}>{task.assigneeInitials}</div>
        )}
        {task.dueDate && (
          <span style={{ fontSize: 10, color: "#9ca3af" }}>📅 {task.dueDate}</span>
        )}
        <div style={{ flex: 1 }} />
        {(task.comments ?? 0) > 0 && (
          <span style={{ fontSize: 10, color: "#9ca3af" }}>💬 {task.comments}</span>
        )}
        {(task.attachments ?? 0) > 0 && (
          <span style={{ fontSize: 10, color: "#9ca3af" }}>📎 {task.attachments}</span>
        )}
      </div>
    </div>
  );
}
