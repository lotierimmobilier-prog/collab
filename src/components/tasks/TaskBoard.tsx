"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { COLUMNS, PRIORITY_STYLES, Task, Status } from "@/lib/tasks";
import TaskCard from "./TaskCard";
import TaskDetail from "./TaskDetail";
import NewTaskModal from "./NewTaskModal";
import TaskFamilyManager from "./TaskFamilyManager";

interface Group { id: string; name: string; }
interface Family { id: string; name: string; color: string; icon?: string; groups: Group[]; }

export default function TaskBoard() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";

  const [tasks, setTasks]           = useState<Task[]>([]);
  const [families, setFamilies]     = useState<Family[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<"board" | "list" | "hierarchy">("board");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [showFamilyMgr, setShowFamilyMgr] = useState(false);
  const [filterFamily, setFilterFamily]   = useState<string>("all");
  const [filterGroup, setFilterGroup]     = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [search, setSearch]         = useState("");
  const [dragId, setDragId]         = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState<Status | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const [tr, fr] = await Promise.all([fetch("/api/tasks"), fetch("/api/task-families")]);
      if (tr.ok) setTasks(await tr.json());
      if (fr.ok) setFamilies(await fr.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Rafraîchir quand Auguste crée/modifie une tâche
  useEffect(() => {
    const handler = () => fetchTasks();
    window.addEventListener("collab:task_created", handler);
    window.addEventListener("collab:task_updated", handler);
    return () => {
      window.removeEventListener("collab:task_created", handler);
      window.removeEventListener("collab:task_updated", handler);
    };
  }, [fetchTasks]);

  const currentFamily = families.find(f => f.id === filterFamily);
  const availableGroups = currentFamily?.groups ?? [];

  const filtered = tasks.filter(t => {
    const tAny = t as unknown as Record<string, unknown>;
    if (filterFamily !== "all" && tAny.familyId !== filterFamily) return false;
    if (filterGroup  !== "all" && tAny.groupId  !== filterGroup)  return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterAssignee !== "all" && t.assigneeInitials !== filterAssignee) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function addTask(task: Task) {
    setTasks(prev => [task, ...prev]);
    setShowNew(false);
  }

  async function updateTaskStatus(id: string, status: Status) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function handleDragStart(id: string) { setDragId(id); }
  function handleDragOver(e: React.DragEvent, col: Status) { e.preventDefault(); setDragOver(col); }
  function handleDrop(col: Status) {
    if (dragId) updateTaskStatus(dragId, col);
    setDragId(null); setDragOver(null);
  }

  const assignees = [...new Set(tasks.map(t => t.assigneeInitials).filter(Boolean))];
  const total = tasks.length;
  const done  = tasks.filter(t => t.status === "done").length;

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
      Chargement…
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "0 0 180px" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9ca3af" }}>🔍</span>
          <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 28, paddingRight: 8, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#f9fafb" }} />
        </div>

        {/* Filtre famille */}
        <select value={filterFamily} onChange={e => { setFilterFamily(e.target.value); setFilterGroup("all"); }} style={sel}>
          <option value="all">Toutes familles</option>
          {families.map(f => <option key={f.id} value={f.id}>{f.icon ?? "📁"} {f.name}</option>)}
        </select>

        {/* Filtre groupe — seulement si famille sélectionnée */}
        {filterFamily !== "all" && availableGroups.length > 0 && (
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={sel}>
            <option value="all">Tous groupes</option>
            {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}

        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={sel}>
          <option value="all">Toutes priorités</option>
          <option value="urgent">Urgent</option>
          <option value="haute">Haute</option>
          <option value="moyenne">Moyenne</option>
          <option value="basse">Basse</option>
        </select>

        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={sel}>
          <option value="all">Tous membres</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{done}/{total}</span>
          <div style={{ width: 60, height: 5, background: "#f3f4f6", borderRadius: 3 }}>
            <div style={{ width: total > 0 ? `${Math.round(done/total*100)}%` : "0%", height: "100%", background: "#10b981", borderRadius: 3 }} />
          </div>
        </div>

        {/* Vue toggle */}
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {([["board","⊞ Kanban"],["list","≡ Liste"],["hierarchy","🗂 Hiérarchie"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 10px", fontSize: 11, border: "none", cursor: "pointer", background: view === v ? "#B8966A" : "#fff", color: view === v ? "#fff" : "#6b7280", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button onClick={() => setShowFamilyMgr(true)} style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            🗂 Familles
          </button>
        )}

        <button onClick={() => setShowNew(true)} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          + Nouvelle tâche
        </button>
      </div>

      {/* Vue Kanban */}
      {view === "board" && (
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", padding: "16px 24px", display: "flex", gap: 14 }}>
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id);
            const isOver = dragOver === col.id;
            return (
              <div key={col.id} onDragOver={e => handleDragOver(e, col.id)} onDrop={() => handleDrop(col.id)}
                style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", background: isOver ? "#F7F0E6" : "#f9fafb", borderRadius: 12, border: isOver ? "2px dashed #B8966A" : "1px solid #e5e7eb", transition: "all .15s" }}>
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 }}>{col.label}</span>
                  <span style={{ background: "#e5e7eb", color: "#6b7280", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{colTasks.length}</span>
                  <button onClick={() => setShowNew(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>+</button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px" }}>
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} onDragStart={() => handleDragStart(task.id)} onClick={() => setSelectedTask(task)} />
                  ))}
                  {colTasks.length === 0 && <div style={{ textAlign: "center", padding: "20px 10px", fontSize: 12, color: "#d1d5db" }}>Glisser ici</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vue liste */}
      {view === "list" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id);
            if (!colTasks.length) return null;
            return (
              <div key={col.id} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>{col.label}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>({colTasks.length})</span>
                </div>
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  {colTasks.map((task, i) => (
                    <div key={task.id} onClick={() => setSelectedTask(task)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < colTasks.length-1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ width: 16, height: 16, borderRadius: "50%", border: task.status === "done" ? "none" : "1.5px solid #d1d5db", background: task.status === "done" ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", flexShrink: 0 }}>{task.status === "done" ? "✓" : ""}</span>
                      <span style={{ fontSize: 13, flex: 1, textDecoration: task.status === "done" ? "line-through" : "none", color: task.status === "done" ? "#9ca3af" : "#111827" }}>{task.title}</span>
                      <span style={{ background: PRIORITY_STYLES[task.priority].bg, color: PRIORITY_STYLES[task.priority].text, borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>{PRIORITY_STYLES[task.priority].label}</span>
                      {task.assigneeInitials && <div style={{ width: 26, height: 26, borderRadius: "50%", background: task.assigneeColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#374151" }}>{task.assigneeInitials}</div>}
                      {task.dueDate && <span style={{ fontSize: 11, color: "#9ca3af" }}>📅 {task.dueDate}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vue hiérarchie */}
      {view === "hierarchy" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {families.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🗂</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Aucune famille créée</div>
              {isAdmin && <button onClick={() => setShowFamilyMgr(true)} style={{ marginTop: 12, background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Créer des familles</button>}
            </div>
          )}
          {families.map(family => {
            const familyTasks = tasks.filter(t => (t as unknown as Record<string, unknown>).familyId === family.id && !(t as unknown as Record<string, unknown>).groupId);
            return (
              <div key={family.id} style={{ marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: family.color + "18", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{family.icon ?? "📁"}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{family.name}</span>
                  <span style={{ background: family.color + "30", color: family.color, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 600, marginLeft: "auto" }}>
                    {tasks.filter(t => (t as unknown as Record<string, unknown>).familyId === family.id).length} tâches
                  </span>
                </div>

                {/* Groupes */}
                {family.groups.map(group => {
                  const groupTasks = tasks.filter(t => (t as unknown as Record<string, unknown>).groupId === group.id);
                  return (
                    <div key={group.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ padding: "8px 16px 8px 32px", background: "#f9fafb", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: family.color, fontSize: 12 }}>▸</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>{group.name}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>({groupTasks.length})</span>
                      </div>
                      {groupTasks.map(task => <HierarchyTaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />)}
                    </div>
                  );
                })}

                {/* Tâches directement dans la famille (sans groupe) */}
                {familyTasks.map(task => <HierarchyTaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />)}
              </div>
            );
          })}

          {/* Tâches sans famille */}
          {(() => {
            const orphans = filtered.filter(t => !(t as unknown as Record<string, unknown>).familyId);
            if (!orphans.length) return null;
            return (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: "#f9fafb", fontWeight: 600, fontSize: 14, color: "#374151" }}>📋 Sans famille ({orphans.length})</div>
                {orphans.map(task => <HierarchyTaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />)}
              </div>
            );
          })()}
        </div>
      )}

      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)}
          onStatusChange={status => { updateTaskStatus(selectedTask.id, status); setSelectedTask(p => p ? { ...p, status } : null); }} />
      )}

      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onAdd={addTask} families={families} />}
      {showFamilyMgr && <TaskFamilyManager onClose={() => { setShowFamilyMgr(false); fetchTasks(); }} isAdmin={isAdmin} />}
    </div>
  );
}

function HierarchyTaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 48px", borderTop: "1px solid #f9fafb", cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: { todo: "#d1d5db", inprogress: "#f59e0b", review: "#B8966A", done: "#10b981" }[task.status] ?? "#d1d5db", flexShrink: 0 }} />
      <span style={{ fontSize: 13, flex: 1, color: task.status === "done" ? "#9ca3af" : "#111827", textDecoration: task.status === "done" ? "line-through" : "none" }}>{task.title}</span>
      <span style={{ background: PRIORITY_STYLES[task.priority].bg, color: PRIORITY_STYLES[task.priority].text, borderRadius: 5, padding: "1px 6px", fontSize: 10 }}>{PRIORITY_STYLES[task.priority].label}</span>
      {task.assigneeInitials && <div style={{ width: 22, height: 22, borderRadius: "50%", background: task.assigneeColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#374151" }}>{task.assigneeInitials}</div>}
    </div>
  );
}

const sel: React.CSSProperties = { height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, padding: "0 8px", background: "#f9fafb", color: "#374151", outline: "none", cursor: "pointer" };
