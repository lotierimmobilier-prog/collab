"use client";
import { useState, useEffect } from "react";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK    = "#1C1A17";
const BORDER  = "#E6E1D9";

const FAMILY_COLORS = ["#B8966A", "#0891b2", "#059669", "#dc2626", "#d97706", "#7c3aed", "#db2777"];
const FAMILY_ICONS  = ["📁", "🏠", "📊", "✅", "🎯", "💼", "📋", "🔧", "📅", "👥"];

interface Group { id: string; name: string; description?: string; order: number; }
interface Family {
  id: string; name: string; description?: string;
  color: string; icon?: string; order: number;
  groups: Group[];
  _count?: { tasks: number };
}

export default function TaskFamilyManager({ onClose, isAdmin }: { onClose: () => void; isAdmin: boolean }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [newFamily, setNewFamily]   = useState(false);
  const [newGroup, setNewGroup]     = useState<string | null>(null); // familyId

  useEffect(() => { loadFamilies(); }, []);

  async function loadFamilies() {
    const r = await fetch("/api/task-families");
    if (r.ok) setFamilies(await r.json());
  }

  async function createFamily(data: { name: string; description: string; color: string; icon: string }) {
    await fetch("/api/task-families", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    await loadFamilies();
    setNewFamily(false);
  }

  async function updateFamily(id: string, data: Partial<Family>) {
    await fetch(`/api/task-families/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    await loadFamilies();
    setEditFamily(null);
  }

  async function deleteFamily(id: string) {
    if (!confirm("Supprimer cette famille et tous ses groupes ?")) return;
    await fetch(`/api/task-families/${id}`, { method: "DELETE" });
    await loadFamilies();
  }

  async function createGroup(familyId: string, data: { name: string; description: string }) {
    await fetch("/api/task-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ familyId, ...data }) });
    await loadFamilies();
    setNewGroup(null);
  }

  async function deleteGroup(id: string) {
    await fetch(`/api/task-groups/${id}`, { method: "DELETE" });
    await loadFamilies();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "#fff", zIndex: 50, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: DARK }}>Familles & Groupes</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Structure hiérarchique des tâches</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {families.map(family => (
            <div key={family.id} style={{ marginBottom: 12, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Header famille */}
              <div style={{ padding: "12px 14px", background: family.color + "15", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{family.icon ?? "📁"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: DARK }}>{family.name}</div>
                  {family.description && <div style={{ fontSize: 11, color: "#6b7280" }}>{family.description}</div>}
                  <div style={{ fontSize: 11, color: family.color }}>{family._count?.tasks ?? 0} tâche(s) · {family.groups.length} groupe(s)</div>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setExpanded(expanded === family.id ? null : family.id)}
                      style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, color: "#6b7280" }}>
                      {expanded === family.id ? "▲" : "▼"}
                    </button>
                    <button onClick={() => setEditFamily(family)}
                      style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, color: "#6b7280" }}>✎</button>
                    <button onClick={() => deleteFamily(family.id)}
                      style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>✕</button>
                  </div>
                )}
              </div>

              {/* Groupes de la famille */}
              {expanded === family.id && (
                <div style={{ padding: "8px 14px 12px" }}>
                  {family.groups.map(g => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid #f3f4f6` }}>
                      <span style={{ color: family.color, fontSize: 12 }}>▸</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{g.name}</div>
                        {g.description && <div style={{ fontSize: 11, color: "#9ca3af" }}>{g.description}</div>}
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteGroup(g.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>✕</button>
                      )}
                    </div>
                  ))}

                  {isAdmin && newGroup === family.id ? (
                    <MiniForm placeholder="Nom du groupe" onSave={name => createGroup(family.id, { name, description: "" })} onCancel={() => setNewGroup(null)} />
                  ) : isAdmin && (
                    <button onClick={() => setNewGroup(family.id)}
                      style={{ marginTop: 8, background: "none", border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#9ca3af", width: "100%" }}>
                      + Ajouter un groupe
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {families.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: DARK, marginBottom: 4 }}>Aucune famille</div>
              <div style={{ fontSize: 12 }}>Créez votre première famille pour organiser les tâches</div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div style={{ padding: "14px 16px", borderTop: `1px solid ${BORDER}` }}>
            {newFamily ? (
              <FamilyForm onSave={createFamily} onCancel={() => setNewFamily(false)} />
            ) : (
              <button onClick={() => setNewFamily(true)} style={{ width: "100%", background: GOLD, color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                + Nouvelle famille
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal édition famille */}
      {editFamily && (
        <FamilyEditModal family={editFamily} onSave={data => updateFamily(editFamily.id, data)} onClose={() => setEditFamily(null)} />
      )}
    </>
  );
}

function MiniForm({ placeholder, onSave, onCancel }: { placeholder: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input autoFocus value={v} onChange={e => setV(e.target.value)}
        onKeyDown={e => e.key === "Enter" && v.trim() && onSave(v.trim())}
        placeholder={placeholder}
        style={{ flex: 1, height: 32, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 8px", fontSize: 12, outline: "none" }} />
      <button onClick={() => v.trim() && onSave(v.trim())} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "0 10px", cursor: "pointer", fontSize: 12 }}>OK</button>
      <button onClick={onCancel} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 8px", cursor: "pointer", fontSize: 12, color: "#6b7280" }}>✕</button>
    </div>
  );
}

function FamilyForm({ onSave, onCancel }: { onSave: (d: { name: string; description: string; color: string; icon: string }) => void; onCancel: () => void }) {
  const [name, setName]  = useState("");
  const [desc, setDesc]  = useState("");
  const [color, setColor] = useState(FAMILY_COLORS[0]);
  const [icon, setIcon]  = useState(FAMILY_ICONS[0]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la famille *"
        style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }} />
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optionnel)"
        style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b7280", width: 50 }}>Couleur</span>
        {FAMILY_COLORS.map(c => (
          <div key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "3px solid white" : "3px solid transparent", outline: color === c ? `2px solid ${c}` : "none", boxSizing: "border-box" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b7280", width: 50 }}>Icône</span>
        {FAMILY_ICONS.map(ic => (
          <button key={ic} onClick={() => setIcon(ic)} style={{ fontSize: 16, background: icon === ic ? GOLD_BG : "transparent", border: icon === ic ? `1px solid ${GOLD}` : "1px solid transparent", borderRadius: 6, padding: "2px 4px", cursor: "pointer" }}>{ic}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
        <button onClick={() => name.trim() && onSave({ name, description: desc, color, icon })} disabled={!name.trim()}
          style={{ background: name.trim() ? GOLD : "#e5e7eb", color: name.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>
          Créer
        </button>
      </div>
    </div>
  );
}

function FamilyEditModal({ family, onSave, onClose }: { family: Family; onSave: (d: Partial<Family>) => void; onClose: () => void }) {
  const [name, setName]   = useState(family.name);
  const [desc, setDesc]   = useState(family.description ?? "");
  const [color, setColor] = useState(family.color);
  const [icon, setIcon]   = useState(family.icon ?? FAMILY_ICONS[0]);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 60 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 400, background: "#fff", borderRadius: 14, zIndex: 70, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: DARK }}>Modifier la famille</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom *" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }} />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }} />
          <div style={{ display: "flex", gap: 6 }}>{FAMILY_COLORS.map(c => <div key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "3px solid white" : "3px solid transparent", outline: color === c ? `2px solid ${c}` : "none", boxSizing: "border-box" }} />)}</div>
          <div style={{ display: "flex", gap: 6 }}>{FAMILY_ICONS.map(ic => <button key={ic} onClick={() => setIcon(ic)} style={{ fontSize: 16, background: icon === ic ? GOLD_BG : "transparent", border: icon === ic ? `1px solid ${GOLD}` : "1px solid transparent", borderRadius: 6, padding: "2px 4px", cursor: "pointer" }}>{ic}</button>)}</div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={() => onSave({ name, description: desc, color, icon })} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </>
  );
}
