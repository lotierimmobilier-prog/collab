"use client";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Task, Priority, Status, PRIORITY_STYLES, COLUMNS, RECURRENCES } from "@/lib/tasks";

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
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string })?.id ?? "";
  const [members, setMembers]   = useState<Member[]>([]);
  const [assignee, setAssignee] = useState<Member | null>(null);
  const [rank, setRank]         = useState<string[]>([]);   // ids les plus sollicités (historique)
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [dueDate, setDueDate]   = useState("");
  const [recurrence, setRecurrence] = useState("");
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
        setMembers(users.filter(u => u.active).map(userToMember));
      })
      .catch(() => {});
    fetch("/api/tasks/assignee-rank").then(r => r.ok ? r.json() : null)
      .then(d => setRank(d?.ranked ?? [])).catch(() => {});
  }, []);

  // Par défaut, on attribue la tâche à l'utilisateur courant (priorité), sinon
  // au premier de la liste.
  useEffect(() => {
    if (!assignee && members.length) setAssignee(members.find(m => m.id === myId) ?? members[0]);
  }, [members, myId, assignee]);

  // Ordre : moi d'abord, puis les responsables les plus sollicités, puis alpha.
  const ordered = useMemo(() => {
    const ri = (id: string) => { const i = rank.indexOf(id); return i === -1 ? 9999 : i; };
    return [...members].sort((a, b) => {
      if (a.id === myId && b.id !== myId) return -1;
      if (b.id === myId && a.id !== myId) return 1;
      const d = ri(a.id) - ri(b.id);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  }, [members, rank, myId]);
  const shownMembers = assigneeSearch
    ? ordered.filter(m => m.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
    : ordered;

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
          recurrence: recurrence || null,
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
                <select
                  value={groupId}
                  onChange={e => {
                    const gid = e.target.value;
                    setGroupId(gid);
                    // Auto-sélectionner la famille parente si pas encore choisie
                    if (gid && !familyId) {
                      const parent = families.find(f => f.groups.some(g => g.id === gid));
                      if (parent) setFamilyId(parent.id);
                    }
                  }}
                  style={inp}
                >
                  <option value="">Aucun groupe</option>
                  {families.map(f =>
                    f.groups.length > 0 ? (
                      <optgroup key={f.id} label={`${f.icon ?? "📁"} ${f.name}`}>
                        {f.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </optgroup>
                    ) : null
                  )}
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
            <div style={{ gridColumn: "1 / -1" }}>
              <FL>Assigné à</FL>
              <input value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} placeholder="🔍 Rechercher une personne…"
                style={{ ...inp, marginBottom: 7 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 116, overflowY: "auto" }}>
                {!members.length && <span style={{ fontSize: 12, color: "#9ca3af" }}>Chargement…</span>}
                {shownMembers.map(m => {
                  const sel = assignee?.id === m.id;
                  const me = m.id === myId;
                  return (
                    <button key={m.id} type="button" onClick={() => setAssignee(m)} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
                      border: `1px solid ${sel ? "#B8966A" : "#e5e7eb"}`, background: sel ? "#F7F0E6" : "#fff",
                      color: sel ? "#8a6d3b" : "#374151", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: m.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#374151" }}>{m.initials.toUpperCase()}</span>
                      {m.name}
                      {me && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#B8966A", background: "#F7F0E6", borderRadius: 5, padding: "1px 5px" }}>moi</span>}
                    </button>
                  );
                })}
                {!shownMembers.length && members.length > 0 && <span style={{ fontSize: 12, color: "#9ca3af" }}>Aucun résultat.</span>}
              </div>
            </div>
            <div><FL>Échéance</FL><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} /></div>
            <div><FL>Récurrence</FL><select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={inp}>{RECURRENCES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
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
