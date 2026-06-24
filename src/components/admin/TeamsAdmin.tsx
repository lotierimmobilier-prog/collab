"use client";
import { useState, useEffect } from "react";

interface User { id: string; prenom: string; nom: string; email: string; active: boolean }
interface Team {
  id: string; name: string; color: string; icon?: string; order: number;
  members: { userId: string; user: User }[];
}

const PRESET_TEAMS = [
  { name: "Gestion",      color: "#2563EB", icon: "🏠" },
  { name: "Transaction",  color: "#059669", icon: "🤝" },
  { name: "Syndic",       color: "#7C3AED", icon: "🏢" },
  { name: "Direction",    color: "#B8966A", icon: "⭐" },
];

const COLORS = ["#B8966A","#2563EB","#059669","#7C3AED","#DC2626","#0891B2","#D97706","#374151"];

export default function TeamsAdmin() {
  const [teams, setTeams]     = useState<Team[]>([]);
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Team | null>(null);
  const [saving, setSaving]   = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2563EB");
  const [newIcon, setNewIcon] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/teams").then(r => r.json()), fetch("/api/users").then(r => r.json())])
      .then(([t, u]) => { setTeams(t); setUsers(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function createTeam() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim(), color: newColor, icon: newIcon || undefined, order: teams.length }) });
      const t = await r.json();
      setTeams(prev => [...prev, t]);
      setSelected(t);
      setShowNew(false); setNewName(""); setNewIcon("");
    } finally { setSaving(false); }
  }

  async function createPreset(p: typeof PRESET_TEAMS[0]) {
    if (teams.some(t => t.name === p.name)) return;
    setSaving(true);
    try {
      const r = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, order: teams.length }) });
      const t = await r.json();
      setTeams(prev => [...prev, t]);
    } finally { setSaving(false); }
  }

  async function saveMembers(team: Team, memberIds: string[]) {
    setSaving(true);
    try {
      const r = await fetch(`/api/teams/${team.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberIds }) });
      const updated = await r.json();
      setTeams(prev => prev.map(t => t.id === team.id ? updated : t));
      setSelected(updated);
    } finally { setSaving(false); }
  }

  async function saveTeam(team: Team, patch: Partial<Team>) {
    setSaving(true);
    try {
      const r = await fetch(`/api/teams/${team.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const updated = await r.json();
      setTeams(prev => prev.map(t => t.id === team.id ? updated : t));
      setSelected(updated);
    } finally { setSaving(false); }
  }

  async function deleteTeam(id: string) {
    if (!confirm("Supprimer cette équipe ? Les familles de tâches associées seront rendues visibles par tous.")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    setTeams(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  if (loading) return <div style={{ padding: 32, color: "#9ca3af" }}>Chargement…</div>;

  const missingPresets = PRESET_TEAMS.filter(p => !teams.some(t => t.name === p.name));

  return (
    <div style={{ display: "flex", gap: 0, height: "100%", minHeight: 0 }}>

      {/* Colonne gauche — liste des équipes */}
      <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", background: "#fafafa" }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 8 }}>Équipes</div>
          {missingPresets.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Créer les équipes par défaut :</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {missingPresets.map(p => (
                  <button key={p.name} onClick={() => createPreset(p)} disabled={saving}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: `1px solid ${p.color}`, background: p.color + "12", color: p.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setShowNew(true)}
            style={{ width: "100%", background: "#B8966A", color: "#fff", border: "none", borderRadius: 7, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Nouvelle équipe
          </button>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {teams.map(team => (
            <div key={team.id} onClick={() => setSelected(team)}
              style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: selected?.id === team.id ? team.color + "12" : "#fafafa", borderLeft: `3px solid ${selected?.id === team.id ? team.color : "transparent"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{team.icon ?? "👥"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{team.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{team.members.length} membre{team.members.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: team.color, flexShrink: 0 }} />
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucune équipe</div>
          )}
        </div>
      </div>

      {/* Colonne droite — détail équipe */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {!selected && !showNew && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 14 }}>
            Sélectionnez une équipe
          </div>
        )}

        {/* Formulaire nouvelle équipe */}
        {showNew && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Nouvelle équipe</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={labelStyle}>
                Nom
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex: Gestion" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Icône (emoji)
                <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="🏠" style={{ ...inputStyle, width: 80 }} />
              </label>
              <div>
                <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>Couleur</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: newColor === c ? "3px solid #111" : "2px solid transparent", cursor: "pointer" }} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={createTeam} disabled={!newName.trim() || saving}
                  style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Créer
                </button>
                <button onClick={() => { setShowNew(false); setNewName(""); }}
                  style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Détail équipe sélectionnée */}
        {selected && !showNew && <TeamDetail
          team={selected}
          users={users}
          saving={saving}
          onSaveMembers={ids => saveMembers(selected, ids)}
          onSave={patch => saveTeam(selected, patch)}
          onDelete={() => deleteTeam(selected.id)}
        />}
      </div>
    </div>
  );
}

function TeamDetail({ team, users, saving, onSaveMembers, onSave, onDelete }: {
  team: Team; users: User[]; saving: boolean;
  onSaveMembers: (ids: string[]) => void;
  onSave: (patch: Partial<Team>) => void;
  onDelete: () => void;
}) {
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(team.members.map(m => m.userId)));
  const [editName, setEditName] = useState(team.name);
  const [editIcon, setEditIcon] = useState(team.icon ?? "");
  const [editColor, setEditColor] = useState(team.color);
  const [dirty, setDirty] = useState(false);

  // Reset quand l'équipe change
  useEffect(() => {
    setMemberIds(new Set(team.members.map(m => m.userId)));
    setEditName(team.name); setEditIcon(team.icon ?? ""); setEditColor(team.color);
    setDirty(false);
  }, [team.id, team]);

  function toggle(userId: string) {
    setMemberIds(prev => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n; });
    setDirty(true);
  }

  const activeUsers = users.filter(u => u.active);

  return (
    <div style={{ maxWidth: 600 }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: team.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{team.icon ?? "👥"}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>{team.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{team.members.length} membre{team.members.length !== 1 ? "s" : ""}</div>
        </div>
        <button onClick={onDelete} style={{ marginLeft: "auto", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}>Supprimer</button>
      </div>

      {/* Infos */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          Nom
          <input value={editName} onChange={e => { setEditName(e.target.value); setDirty(true); }} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Icône
          <input value={editIcon} onChange={e => { setEditIcon(e.target.value); setDirty(true); }} placeholder="🏠" style={{ ...inputStyle, width: 60 }} />
        </label>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>Couleur</div>
        <div style={{ display: "flex", gap: 6 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setEditColor(c); setDirty(true); }} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: editColor === c ? "3px solid #111" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </div>
      {dirty && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button onClick={() => { onSave({ name: editName, icon: editIcon || undefined, color: editColor }); onSaveMembers([...memberIds]); setDirty(false); }}
            disabled={saving} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}

      {/* Membres */}
      <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 12 }}>Membres de l'équipe</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activeUsers.map(u => {
          const checked = memberIds.has(u.id);
          return (
            <div key={u.id} onClick={() => toggle(u.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${checked ? team.color : "#e5e7eb"}`, background: checked ? team.color + "0A" : "#fff", cursor: "pointer", transition: "all 0.1s" }}>
              <input type="checkbox" checked={checked} onChange={() => {}} style={{ width: 16, height: 16, accentColor: team.color, cursor: "pointer" }} />
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: team.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {u.prenom[0]}{u.nom[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{u.prenom} {u.nom}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email}</div>
              </div>
              {checked && <span style={{ fontSize: 11, color: team.color, fontWeight: 600, background: team.color + "15", padding: "2px 7px", borderRadius: 5 }}>Membre</span>}
            </div>
          );
        })}
      </div>

      {dirty && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => { onSaveMembers([...memberIds]); onSave({ name: editName, icon: editIcon || undefined, color: editColor }); setDirty(false); }}
            disabled={saving} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Enregistrement…" : "✓ Enregistrer les membres"}
          </button>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "#374151", fontWeight: 500 };
const inputStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", fontFamily: "inherit" };
