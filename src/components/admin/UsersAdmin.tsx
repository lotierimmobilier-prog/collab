"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Role, ModuleAccess, Right, DEFAULT_ROLES, getInitials, avatarColor, MODULES, RIGHTS, getRightStyle } from "@/lib/admin";
import { isSuperAdminEmail, isAdminRole } from "@/lib/superadmin";
import { useIsMobile } from "@/lib/useIsMobile";
import UserModal from "./UserModal";

export default function UsersAdmin() {
  const { data: session, update } = useSession();
  const isSuper = session?.user?.superAdmin === true;
  const isMobile = useIsMobile();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles] = useState<Role[]>(DEFAULT_ROLES);
  const [editing, setEditing] = useState<User | null | "new">(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [editingAccess, setEditingAccess] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  // Charger les utilisateurs depuis l'API
  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setApiError("Impossible de charger les utilisateurs : " + String(e));
    } finally { setLoading(false); }
  }

  async function saveUser(user: User) {
    const isNew = !users.find(u => u.id === user.id);
    try {
      const res = await fetch(isNew ? "/api/users" : `/api/users/${user.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenom: user.prenom, nom: user.nom, email: user.email,
          password: user.password, roleId: user.roleId, active: user.active,
          accessOverrides: user.accessOverrides ?? null,
          gedAccess: user.gedAccess ?? null,
          parrainId: user.parrainId ?? null,
          isEmployee: (user as { isEmployee?: boolean }).isEmployee ?? false,
          city: (user as { city?: string | null }).city ?? null,
          superAdmin: (user as { superAdmin?: boolean }).superAdmin ?? false,
          hiddenMenus: (user as { hiddenMenus?: string[] }).hiddenMenus ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error ?? "Erreur"); return; }
      setApiError("");
      await fetchUsers();
      if (isNew) {
        alert(data.welcomeEmailSent
          ? `Utilisateur créé ✅\nUn email de bienvenue a été envoyé à ${user.email} avec le lien pour créer son mot de passe.`
          : `Utilisateur créé ✅\n⚠️ L'email de bienvenue n'a pas pu être envoyé (vérifiez la configuration SMTP). Vous pouvez communiquer le mot de passe manuellement.`);
      }
    } catch (e) { setApiError(String(e)); }
    setEditing(null);
  }

  async function resendWelcome(user: { id: string; prenom: string; nom: string; email: string }) {
    if (!confirm(`Renvoyer l'email d'activation (avec un nouveau lien de création de mot de passe) à ${user.prenom} ${user.nom} (${user.email}) ?`)) return;
    try {
      const r = await fetch(`/api/users/${user.id}/welcome`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      alert(r.ok
        ? `Email d'activation renvoyé à ${user.email} ✅`
        : `Échec de l'envoi ⚠️\n${d.error || "Vérifiez la configuration SMTP."}`);
    } catch { alert("Échec de l'envoi. Réessayez."); }
  }

  async function toggleActive(id: string) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
  }

  async function deleteUser(id: string) {
    if (!confirm("Supprimer cet utilisateur définitivement ?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  // Applique les migrations à la demande (répare un schéma de base incomplet).
  const [migrating, setMigrating] = useState(false);
  async function runMigrate() {
    setMigrating(true);
    try {
      const r = await fetch("/api/admin/migrate", { method: "POST" });
      const d = await r.json();
      const cols = d?.report?.columns ?? {};
      const lignes = Object.entries(cols).map(([k, v]) => `${v ? "✓" : "✗"} ${k}`).join("\n");
      alert(
        (d.ok ? "✅ Base à jour." : "⚠️ Migrations exécutées, vérifiez ci-dessous.") +
        `\n\nInstructions appliquées : ${d?.report?.applied ?? "?"}\n${lignes}` +
        (d?.report?.error ? `\n\nErreur : ${d.report.error}` : "")
      );
      await fetchUsers();
    } catch (e) { alert("Échec : " + String(e)); }
    finally { setMigrating(false); }
  }

  // « Prendre la main » : ouvre le logiciel avec la vue de l'utilisateur.
  async function impersonate(user: User) {
    if (!confirm(`Prendre la main sur le compte de ${user.prenom} ${user.nom} ?\nVous verrez le logiciel comme cet utilisateur. Un bandeau rouge vous permettra de revenir.`)) return;
    await update({ impersonate: user.id });
    router.push("/");
    router.refresh();
  }

  const roleOf = (roleId: string) => roles.find(r => r.id === roleId);

  const filtered = users.filter(u => {
    if (filterRole !== "all" && u.roleId !== filterRole) return false;
    const q = search.toLowerCase();
    return !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q);
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {apiError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 24px", fontSize: 13 }}>
          {apiError}
        </div>
      )}
      {/* Toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: isMobile ? "10px 14px" : "12px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "0 0 220px" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
          <input placeholder="Rechercher un utilisateur…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 30, height: 34, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: "#f9fafb" }} />
        </div>

        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={sel}>
          <option value="all">Tous les rôles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <button onClick={runMigrate} disabled={migrating} style={{ ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6 }} title="Applique les migrations manquantes (répare les colonnes/tables récentes)">
          {migrating ? "Mise à jour…" : "🛠 Mettre à jour la base"}
        </button>
        <a href="/admin/roles" style={{ ...btnSecondary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          ⚙ Gérer les rôles
        </a>
        <button onClick={() => setEditing("new")} style={btnPrimary}>+ Nouvel utilisateur</button>
      </div>

      {/* Stats */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: isMobile ? "10px 14px" : "10px 24px", display: "flex", gap: isMobile ? 14 : 24, flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible" }}>
        <Stat label="Total" value={users.length} />
        <Stat label="Actifs" value={users.filter(u => u.active).length} color="#059669" />
        <Stat label="Inactifs" value={users.filter(u => !u.active).length} color="#9ca3af" />
        {roles.map(r => (
          <Stat key={r.id} label={r.label} value={users.filter(u => u.roleId === r.id).length} color={r.color} />
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: isMobile ? "12px" : "20px 24px" }}>
        {loading ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "60px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            Chargement des utilisateurs...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Aucun utilisateur</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Créez votre premier utilisateur pour commencer</div>
            <button onClick={() => setEditing("new")} style={btnPrimary}>+ Créer un utilisateur</button>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Header (masqué sur mobile : affichage en cartes) */}
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1.5fr 0.9fr 1.1fr 0.9fr 95px 176px", padding: "10px 16px", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", gap: 12 }}>
                <span>Utilisateur</span><span>Email</span><span>Rôle</span><span>Parrain</span><span>Accès modules</span><span>Statut</span><span>Actions</span>
              </div>
            )}

            {filtered.map((user, i) => {
              const role = roleOf(user.roleId);
              const ac = avatarColor(user.id);
              const accessCount = role?.modules.filter(m => m.right !== "aucun").length ?? 0;
              const parrain = user.parrainId ? users.find(x => x.id === user.parrainId) : null;

              const roleBadge = (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                  {role ? (
                    <span style={{ background: role.color + "18", color: role.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, width: "fit-content" }}>
                      {role.label}
                    </span>
                  ) : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}
                  {user.superAdmin && (
                    <span title="Super administrateur" style={{ background: "#1C1A17", color: "#D8B783", borderRadius: 6, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, width: "fit-content", letterSpacing: "0.02em" }}>★ Super admin</span>
                  )}
                </div>
              );

              const accessBar = (
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {accessCount}/{MODULES.length} modules
                  <div style={{ height: 3, background: "#f3f4f6", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ width: `${Math.round((accessCount / MODULES.length) * 100)}%`, height: "100%", background: role?.color ?? "#e5e7eb", borderRadius: 2 }} />
                  </div>
                </div>
              );

              const activeToggle = (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div onClick={() => toggleActive(user.id)} style={{ width: 36, height: 20, borderRadius: 10, background: user.active ? "#B8966A" : "#e5e7eb", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: user.active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                  </div>
                  <span style={{ fontSize: 11, color: user.active ? "#059669" : "#9ca3af" }}>{user.active ? "Actif" : "Inactif"}</span>
                </div>
              );

              // Gouvernance : un admin non super ne gère ni les comptes admin,
              // ni les super admins (seul le super admin le peut).
              const targetGoverned = isAdminRole(user.roleId) || !!user.superAdmin;
              const isBootstrap = isSuperAdminEmail(user.email);
              const lockManage = targetGoverned && !isSuper && user.id !== session?.user?.id;
              const lockDelete = isBootstrap || (targetGoverned && !isSuper);
              const dis: React.CSSProperties = { opacity: 0.4, cursor: "not-allowed" };
              const actions = (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                  {session?.user?.id !== user.id && !(isBootstrap && !isSuper) && (
                    <button onClick={() => impersonate(user)} title="Prendre la main (voir le logiciel en tant que cet utilisateur)" style={{ background: "#F7F0E6", border: "1px solid #B8966A", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: "#B8966A" }}>👤→</button>
                  )}
                  <button onClick={() => !lockManage && setEditing(user)} disabled={lockManage} title={lockManage ? "Réservé au super administrateur" : "Modifier"} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: "#374151", ...(lockManage ? dis : {}) }}>✏</button>
                  <button onClick={() => !lockManage && setEditingAccess(user)} disabled={lockManage} title={lockManage ? "Réservé au super administrateur" : "Gérer les accès"} style={{ background: user.accessOverrides?.length ? "#F7F0E6" : "none", border: `1px solid ${user.accessOverrides?.length ? "#B8966A" : "#e5e7eb"}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: user.accessOverrides?.length ? "#B8966A" : "#374151", ...(lockManage ? dis : {}) }}>🔐</button>
                  <button onClick={() => setShowPassword(showPassword === user.id ? null : user.id)} title="Voir le mot de passe" style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: "#374151" }}>🔑</button>
                  <button onClick={() => resendWelcome(user)} title="Renvoyer l'email d'activation (nouveau lien de mot de passe)" style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: "#374151" }}>📨</button>
                  <button onClick={() => !lockDelete && deleteUser(user.id)} disabled={lockDelete} title={lockDelete ? "Réservé au super administrateur" : "Supprimer"} style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: "#dc2626", ...(lockDelete ? dis : {}) }}>🗑</button>
                </div>
              );

              const avatar = (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: ac.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: ac.text, flexShrink: 0 }}>
                  {getInitials(user.prenom, user.nom)}
                </div>
              );

              // ── Carte (mobile) ──
              if (isMobile) {
                return (
                  <div key={user.id} style={{ padding: "14px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {avatar}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{user.prenom} {user.nom}</div>
                        <div style={{ fontSize: 12.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                      </div>
                      {activeToggle}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      {roleBadge}
                      {parrain && <span style={{ fontSize: 12, color: "#6b7280" }}>👥 {parrain.prenom} {parrain.nom}</span>}
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{accessCount}/{MODULES.length} modules</span>
                    </div>
                    {actions}
                  </div>
                );
              }

              // ── Ligne (bureau) ──
              return (
                <div key={user.id} style={{ display: "grid", gridTemplateColumns: "2.1fr 1.5fr 0.9fr 1.1fr 0.9fr 95px 176px", padding: "12px 16px", gap: 12, alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid #f9fafb" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {avatar}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{user.prenom} {user.nom}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>Créé le {user.createdAt}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                  {roleBadge}
                  <div style={{ fontSize: 12.5, color: parrain ? "#374151" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{parrain ? `${parrain.prenom} ${parrain.nom}` : "—"}</div>
                  {accessBar}
                  {activeToggle}
                  {actions}
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
          allUsers={users}
          isSuper={isSuper}
          onClose={() => setEditing(null)}
          onSave={saveUser}
        />
      )}

      {editingAccess && (
        <AccessPanel
          user={editingAccess}
          role={roles.find(r => r.id === editingAccess.roleId)}
          onClose={() => setEditingAccess(null)}
          onSave={user => { saveUser(user); setEditingAccess(null); }}
        />
      )}
    </div>
  );
}

/* ── Panneau accès rapide ─────────────────────────────────── */
function AccessPanel({ user, role, onClose, onSave }: {
  user: User; role: Role | undefined;
  onClose: () => void; onSave: (u: User) => void;
}) {
  const [overrides, setOverrides] = useState<ModuleAccess[]>(user.accessOverrides ?? []);

  function getRoleRight(moduleId: string): Right {
    return role?.modules.find(m => m.moduleId === moduleId)?.right ?? "aucun";
  }
  function getEffective(moduleId: string): Right {
    return overrides.find(o => o.moduleId === moduleId)?.right ?? getRoleRight(moduleId);
  }
  function setRight(moduleId: string, right: Right) {
    if (right === getRoleRight(moduleId)) {
      setOverrides(p => p.filter(o => o.moduleId !== moduleId));
    } else {
      setOverrides(p => {
        const ex = p.find(o => o.moduleId === moduleId);
        return ex ? p.map(o => o.moduleId === moduleId ? { ...o, right } : o) : [...p, { moduleId, right }];
      });
    }
  }

  const ac = avatarColor(user.id);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(500px, 100vw)", maxWidth: "100vw", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: ac.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: ac.text }}>
                {getInitials(user.prenom, user.nom)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{user.prenom} {user.nom}</div>
                <div style={{ fontSize: 11, color: role?.color ?? "#9ca3af" }}>{role?.label ?? "Aucun rôle"} {overrides.length > 0 && `· ${overrides.length} accès perso`}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Accès & permissions</div>
            {overrides.length > 0 && (
              <button onClick={() => setOverrides([])} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "1px solid #fecaca", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>
                Réinitialiser tout
              </button>
            )}
          </div>
        </div>

        {/* Modules */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {MODULES.map((mod, i) => {
            const effective = getEffective(mod.id);
            const roleRight = getRoleRight(mod.id);
            const hasOv = overrides.some(o => o.moduleId === mod.id);
            return (
              <div key={mod.id} style={{ padding: "12px 20px", borderBottom: i < MODULES.length - 1 ? "1px solid #f3f4f6" : "none", background: hasOv ? "#faf5ff" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{mod.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{mod.label}</div>
                      {hasOv && (
                        <div style={{ fontSize: 10, color: "#B8966A", marginTop: 1 }}>
                          Perso · rôle : <strong>{getRightStyle(roleRight).label}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                    {RIGHTS.map(r => {
                      const active = effective === r.value;
                      return (
                        <button key={r.value} onClick={() => setRight(mod.id, r.value)} style={{
                          padding: "4px 9px", fontSize: 11, fontWeight: active ? 700 : 400,
                          border: `1.5px solid ${active ? r.color : "#e5e7eb"}`,
                          borderRadius: 6, cursor: "pointer",
                          background: active ? r.bg : "#fff",
                          color: active ? r.color : "#9ca3af",
                        }}>{r.label}</button>
                      );
                    })}
                    {hasOv && (
                      <button onClick={() => setOverrides(p => p.filter(o => o.moduleId !== mod.id))} title="Revenir au rôle" style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 6px", fontSize: 11, cursor: "pointer", color: "#9ca3af" }}>↺</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Résumé actif */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Accès actifs</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
            {MODULES.map(mod => {
              const right = getEffective(mod.id);
              if (right === "aucun") return null;
              const s = getRightStyle(right);
              const hasOv = overrides.some(o => o.moduleId === mod.id);
              return (
                <span key={mod.id} style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30`, borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                  {mod.icon} {mod.label}{hasOv ? " ★" : ""}
                </span>
              );
            })}
            {MODULES.every(m => getEffective(m.id) === "aucun") && <span style={{ fontSize: 12, color: "#9ca3af" }}>Aucun accès accordé</span>}
          </div>
          <button
            onClick={() => onSave({ ...user, accessOverrides: overrides.length > 0 ? overrides : undefined })}
            style={{ width: "100%", background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Enregistrer les accès
          </button>
        </div>
      </div>
    </>
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
const btnPrimary: React.CSSProperties = { background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" };
