"use client";
import { useState } from "react";
import { User, Role, DEFAULT_ROLES, getInitials, avatarColor, MODULES } from "@/lib/admin";
import UserModal from "./UserModal";

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [editing, setEditing] = useState<User | null | "new">(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showPassword, setShowPassword] = useState<string | null>(null);

  const filtered = users.filter(u => {
    if (filterRole !== "all" && u.roleId !== filterRole) return false;
    const q = search.toLowerCase();
    return !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q);
  });

  function saveUser(user: User) {
    setUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      return exists ? prev.map(u => u.id === user.id ? user : u) : [user, ...prev];
    });
    setEditing(null);
  }

  function toggleActive(id: string) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
  }

  function deleteUser(id: string) {
    if (confirm("Supprimer cet utilisateur ?")) setUsers(prev => prev.filter(u => u.id !== id));
  }

  const roleOf = (roleId: string) => roles.find(r => r.id === roleId);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "0 0 220px" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
          <input placeholder="Rechercher un utilisateur…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 30, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#f9fafb" }} />
        </div>

        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={sel}>
          <option value="all">Tous les rôles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <a href="/admin/roles" style={{ ...btnSecondary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          ⚙ Gérer les rôles
        </a>
        <button onClick={() => setEditing("new")} style={btnPrimary}>+ Nouvel utilisateur</button>
      </div>

      {/* Stats */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "10px 24px", display: "flex", gap: 24 }}>
        <Stat label="Total" value={users.length} />
        <Stat label="Actifs" value={users.filter(u => u.active).length} color="#059669" />
        <Stat label="Inactifs" value={users.filter(u => !u.active).length} color="#9ca3af" />
        {roles.map(r => (
          <Stat key={r.id} label={r.label} value={users.filter(u => u.roleId === r.id).length} color={r.color} />
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Aucun utilisateur</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Créez votre premier utilisateur pour commencer</div>
            <button onClick={() => setEditing("new")} style={btnPrimary}>+ Créer un utilisateur</button>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 2fr 1.2fr 1fr 100px 80px", padding: "10px 16px", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", gap: 12 }}>
              <span>Utilisateur</span><span>Email</span><span>Rôle</span><span>Accès modules</span><span>Statut</span><span>Actions</span>
            </div>

            {filtered.map((user, i) => {
              const role = roleOf(user.roleId);
              const ac = avatarColor(user.id);
              const accessCount = role?.modules.filter(m => m.right !== "aucun").length ?? 0;
              return (
                <div key={user.id} style={{ display: "grid", gridTemplateColumns: "2.5fr 2fr 1.2fr 1fr 100px 80px", padding: "12px 16px", gap: 12, alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid #f9fafb" : "none" }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: ac.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: ac.text, flexShrink: 0 }}>
                      {getInitials(user.prenom, user.nom)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{user.prenom} {user.nom}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>Créé le {user.createdAt}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>

                  {role ? (
                    <span style={{ background: role.color + "18", color: role.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, width: "fit-content" }}>
                      {role.label}
                    </span>
                  ) : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}

                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {accessCount}/{MODULES.length} modules
                    <div style={{ height: 3, background: "#f3f4f6", borderRadius: 2, marginTop: 4 }}>
                      <div style={{ width: `${Math.round((accessCount / MODULES.length) * 100)}%`, height: "100%", background: role?.color ?? "#e5e7eb", borderRadius: 2 }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      onClick={() => toggleActive(user.id)}
                      style={{ width: 36, height: 20, borderRadius: 10, background: user.active ? "#7c3aed" : "#e5e7eb", cursor: "pointer", position: "relative", transition: "background .2s" }}
                    >
                      <div style={{ position: "absolute", top: 2, left: user.active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: user.active ? "#059669" : "#9ca3af" }}>{user.active ? "Actif" : "Inactif"}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditing(user)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#374151" }}>✏</button>
                    <button
                      onClick={() => setShowPassword(showPassword === user.id ? null : user.id)}
                      title="Voir le mot de passe"
                      style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#374151" }}
                    >🔑</button>
                    <button onClick={() => deleteUser(user.id)} style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Password reveal tooltip */}
        {showPassword && (() => {
          const u = users.find(u => u.id === showPassword);
          if (!u) return null;
          return (
            <div style={{ position: "fixed", bottom: 24, right: 24, background: "#1f2937", color: "#fff", borderRadius: 10, padding: "12px 16px", fontSize: 13, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Mot de passe — {u.prenom} {u.nom}</div>
              <code style={{ fontSize: 15, letterSpacing: "0.1em" }}>{u.password}</code>
              <button onClick={() => setShowPassword(null)} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer" }}>Fermer</button>
            </div>
          );
        })()}
      </div>

      {editing && (
        <UserModal
          user={editing === "new" ? null : editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSave={saveUser}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: color ?? "#111827" }}>{value}</span>
      <span style={{ fontSize: 12, color: "#9ca3af" }}>{label}</span>
    </div>
  );
}

const sel: React.CSSProperties = { height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, padding: "0 10px", background: "#f9fafb", color: "#374151", outline: "none" };
const btnPrimary: React.CSSProperties = { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" };
