"use client";
import { useState, useEffect } from "react";
import { Task, Priority, Status, PRIORITY_STYLES, COLUMNS } from "@/lib/tasks";

const AVATAR_COLORS = ["#F7F0E6", "#dcfce7", "#dbeafe", "#fce7f3", "#fef3c7", "#ede9fe"];

interface Member { id: string; initials: string; name: string; color: string; }
interface Group  { id: string; name: string; }
interface Family { id: string; name: string; color: string; icon?: string; groups: Group[]; }

function userToMember(u: { id: string; prenom: string; nom: string }, i: number): Member {
  return {
    id: u.id,
    initials: (u.prenom[0] ?? "") + (u.nom[0] ?? ""),
    name: `${u.prenom} ${u.nom}`,
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
  };
}

export default function NewTaskModal({ onClose, onAdd, families = [] }: {
  onClose: () => void;
  onAdd: (task: Task) => void;
  families?: Family[];
}) {
  const [title, setTitle]       = useState("");
  const [priority, setPriority] = useState<Priority>("moyenne");
  const [status, setStatus]     = useState<Status>("todo");
  const [members, setMembers]   = useState<Member[]>([]);
  const [assignee, setAssignee] = useState<Member | null>(null);
  const [dueDate, setDueDate]   = useState("");
  const [project, setProject]   = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]         = useState<string[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [groupId, setGroupId]   = useState("");
  const [saving, setSaving]     = useState(false);

  const selectedFamily = families.find(f => f.id === familyId);
  const availableGroups = selectedFamily?.groups ?? [];

  useEffect(() => {
    fetch("/api/users")
      .then(r => r.json())
      .then((users: { id: string; prenom: string; nom: string; active: boolean }[]) => {
        const active = users.filter(u => u.active).map(userToMember);
        setMembers(active);
        if (active.length > 0) setAssignee(active[0]);
      })
      .catch(() => {});
  }, []);

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  }

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), status, priority,
          assigneeId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          dueDate: dueDate || null,
          tags: tags.length ? tags : [],
          project: project || null,
          familyId: familyId || null,
          groupId:  groupId  || null,
        }),
      });
      if (!r.ok) { setSaving(false); return; }
      const created = await r.json();
      const task: Task = {
        id: created.id, title: created.title,
        status: created.status as Status, priority: created.priority as Priority,
        assignee: assignee?.name ?? "", assigneeInitials: assignee?.initials ?? "?",
        assigneeColor: assignee?.color ?? "#f3f4f6",
        dueDate: created.dueDate ?? undefined, tags: created.tags?.length ? created.tags : undefined,
        project: created.project ?? undefined, comments: 0, attachments: 0,
      };
      onAdd(task);
    } finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 540, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>Nouvelle tâche</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 13 }}>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Titre de la tâche *" style={inp} />

          {/* Famille + Groupe */}
          {families.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <FL>Famille</FL>
                <select value={familyId} onChange={e => { setFamilyId(e.target.value); setGroupId(""); }} style={inp}>
                  <option value="">Aucune famille</option>
                  {families.map(f => <option key={f.id} value={f.id}>{f.icon ?? "📁"} {f.name}</option>)}
                </select>
              </div>
              <div>
                <FL>Groupe</FL>
                <select value={groupId} onChange={e => setGroupId(e.target.value)} style={inp} disabled={!availableGroups.length}>
                  <option value="">Aucun groupe</option>
                  {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><FL>Statut</FL><select value={status} onChange={e => setStatus(e.target.value as Status)} style={inp}>{COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><FL>Priorité</FL>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={inp}>
                {(Object.entries(PRIORITY_STYLES) as [Priority, typeof PRIORITY_STYLES[Priority]][]).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <FL>Assigné à</FL>
              <select value={assignee?.id ?? ""} onChange={e => setAssignee(members.find(m => m.id === e.target.value) ?? null)} style={inp} disabled={!members.length}>
                {!members.length && <option value="">Chargement…</option>}
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div><FL>Échéance</FL><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} /></div>
          </div>

          <div>
            <FL>Projet</FL>
            <input value={project} onChange={e => setProject(e.target.value)} placeholder="ex. Gestion locative" style={inp} />
          </div>

          <div>
            <FL>Étiquettes (Entrée pour ajouter)</FL>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 }}>
              {tags.map(tag => (
                <span key={tag} style={{ background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "3px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  {tag}<button onClick={() => setTags(p => p.filter(t => t !== tag))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 12 }}>×</button>
                </span>
              ))}
            </div>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Ajouter une étiquette…" style={inp} />
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!title.trim() || saving} style={{ background: title.trim() && !saving ? "#B8966A" : "#e5e7eb", color: title.trim() && !saving ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: title.trim() && !saving ? "pointer" : "default" }}>
            {saving ? "Enregistrement…" : "Créer la tâche"}
          </button>
        </div>
      </div>
    </>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 500, color: "#374151", marginBottom: 4 }}>{children}</div>;
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
