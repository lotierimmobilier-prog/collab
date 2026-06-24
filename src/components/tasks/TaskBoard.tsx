"use client";
import { useState } from "react";
import { COLUMNS, INITIAL_TASKS, PRIORITY_STYLES, Task, Status } from "@/lib/tasks";
import TaskCard from "./TaskCard";
import TaskDetail from "./TaskDetail";
import NewTaskModal from "./NewTaskModal";

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const filtered = tasks.filter(t => {
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterAssignee !== "all" && t.assigneeInitials !== filterAssignee) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function addTask(task: Task) {
    setTasks(prev => [task, ...prev]);
    setShowNew(false);
  }

  function updateTaskStatus(id: string, status: Status) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }

  function handleDragStart(id: string) { setDragId(id); }
  function handleDragOver(e: React.DragEvent, col: Status) {
    e.preventDefault();
    setDragOver(col);
  }
  function handleDrop(col: Status) {
    if (dragId) { updateTaskStatus(dragId, col); }
    setDragId(null);
    setDragOver(null);
  }

  const assignees = [...new Set(tasks.map(t => t.assigneeInitials).filter(Boolean))];
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "0 0 220px" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af" }}>🔍</span>
          <input
            placeholder="Rechercher une tâche…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", paddingLeft: 30, paddingRight: 8, height: 34,
              border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13,
              outline: "none", background: "#f9fafb",
            }}
          />
        </div>

        {/* Filters */}
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selectStyle}>
          <option value="all">Toutes priorités</option>
          <option value="urgent">Urgent</option>
          <option value="haute">Haute</option>
          <option value="moyenne">Moyenne</option>
          <option value="basse">Basse</option>
        </select>

        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={selectStyle}>
          <option value="all">Tous les membres</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{done}/{total} terminées</span>
          <div style={{ width: 80, height: 6, background: "#f3f4f6", borderRadius: 3 }}>
            <div style={{ width: `${Math.round((done / total) * 100)}%`, height: "100%", background: "#10b981", borderRadius: 3 }} />
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {(["board", "list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 12px", fontSize: 12, border: "none", cursor: "pointer",
              background: view === v ? "#B8966A" : "#fff",
              color: view === v ? "#fff" : "#6b7280",
            }}>
              {v === "board" ? "⊞ Kanban" : "≡ Liste"}
            </button>
          ))}
        </div>

        <button onClick={() => setShowNew(true)} style={{
          background: "#B8966A", color: "#fff", border: "none", borderRadius: 8,
          padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          + Nouvelle tâche
        </button>
      </div>

      {/* Board */}
      {view === "board" ? (
        <div style={{
          flex: 1, overflowX: "auto", overflowY: "hidden",
          padding: "20px 24px", display: "flex", gap: 14,
        }}>
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id);
            const isOver = dragOver === col.id;
            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDrop={() => handleDrop(col.id)}
                style={{
                  width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
                  background: isOver ? "#F7F0E6" : "#f9fafb",
                  borderRadius: 12, border: isOver ? "2px dashed #B8966A" : "1px solid #e5e7eb",
                  transition: "all .15s",
                }}
              >
                {/* Column header */}
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 }}>{col.label}</span>
                  <span style={{
                    background: "#e5e7eb", color: "#6b7280", borderRadius: 10,
                    padding: "1px 7px", fontSize: 11, fontWeight: 500,
                  }}>{colTasks.length}</span>
                  <button onClick={() => { setShowNew(true); }} style={{
                    background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
                    fontSize: 18, lineHeight: 1, padding: "0 2px",
                  }}>+</button>
                </div>

                {/* Cards */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px" }}>
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDragStart={() => handleDragStart(task.id)}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{
                      textAlign: "center", padding: "24px 12px",
                      fontSize: 12, color: "#d1d5db",
                    }}>
                      Glisser des tâches ici
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id);
            if (colTasks.length === 0) return null;
            return (
              <div key={col.id} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>({colTasks.length})</span>
                </div>
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  {colTasks.map((task, i) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                        borderBottom: i < colTasks.length - 1 ? "1px solid #f3f4f6" : "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: task.status === "done" ? "none" : "1.5px solid #d1d5db",
                        background: task.status === "done" ? "#10b981" : "transparent",
                        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#fff",
                      }}>{task.status === "done" ? "✓" : ""}</span>

                      <span style={{
                        fontSize: 13, flex: 1,
                        textDecoration: task.status === "done" ? "line-through" : "none",
                        color: task.status === "done" ? "#9ca3af" : "#111827",
                      }}>{task.title}</span>

                      <span style={{
                        ...PRIORITY_STYLES[task.priority],
                        background: PRIORITY_STYLES[task.priority].bg,
                        color: PRIORITY_STYLES[task.priority].text,
                        borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 500,
                      }}>{PRIORITY_STYLES[task.priority].label}</span>

                      {task.assigneeInitials && (
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: task.assigneeColor, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 600, color: "#374151",
                        }}>{task.assigneeInitials}</div>
                      )}

                      {task.dueDate && (
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>📅 {task.dueDate}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={(status) => {
            updateTaskStatus(selectedTask.id, status);
            setSelectedTask(prev => prev ? { ...prev, status } : null);
          }}
        />
      )}

      {/* New task modal */}
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onAdd={addTask} />}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 34, border: "1px solid #e5e7eb", borderRadius: 8,
  fontSize: 13, padding: "0 10px", background: "#f9fafb",
  color: "#374151", outline: "none", cursor: "pointer",
};
