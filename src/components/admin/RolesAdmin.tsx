"use client";
import { useState } from "react";
import { Role, DEFAULT_ROLES, MODULES, RIGHTS, Right, ModuleAccess, getRightStyle } from "@/lib/admin";

export default function RolesAdmin() {
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState<Role>(DEFAULT_ROLES[0]);
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#B8966A");
  const [dirty, setDirty] = useState(false);

  function selectRole(role: Role) {
    setSelectedRole(role);
    setDirty(false);
  }

  function setModuleRight(moduleId: string, right: Right) {
    const updated: Role = {
      ...selectedRole,
      modules: selectedRole.modules.map(m =>
        m.moduleId === moduleId ? { ...m, right } : m
      ),
    };
    setSelectedRole(updated);
    setDirty(true);
  }

  function setAllRights(right: Right) {
    const updated: Role = { ...selectedRole, modules: selectedRole.modules.map(m => ({ ...m, right })) };
    setSelectedRole(updated);
    setDirty(true);
  }

  function saveRole() {
    setRoles(prev => prev.map(r => r.id === selectedRole.id ? selectedRole : r));
    setDirty(false);
  }

  function createRole() {
    if (!newLabel.trim()) return;
    const role: Role = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      color: newColor,
      description: newDesc.trim(),
      modules: MODULES.map(m => ({ moduleId: m.id, right: "aucun" as Right })),
    };
    setRoles(prev => [...prev, role]);
    setSelectedRole(role);
    setShowNew(false);
    setNewLabel(""); setNewDesc("");
  }

  function deleteRole(id: string) {
    if (roles.find(r => r.id === id)?.isSystem) return;
    if (confirm("Supprimer ce rôle ?")) {
      const remaining = roles.filter(r => r.id !== id);
      setRoles(remaining);
      setSelectedRole(remaining[0]);
    }
  }

  const getRight = (moduleId: string): Right =>
    selectedRole.modules.find(m => m.moduleId === moduleId)?.right ?? "aucun";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Configurez les droits d'accès par rôle et par module</span>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Nouveau rôle</button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar rôles */}
        <div style={{ width: 220, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb", overflowY: "auto" }}>
          <div style={{ padding: "12px 16px 6px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Rôles</div>
          {roles.map(role => (
            <div
              key={role.id}
              onClick={() => selectRole(role)}
              style={{
                padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                background: selectedRole.id === role.id ? "#F7F0E6" : "transparent",
                borderLeft: selectedRole.id === role.id ? `3px solid ${role.color}` : "3px solid transparent",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: role.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: selectedRole.id === role.id ? 600 : 400, color: selectedRole.id === role.id ? role.color : "#374151" }}>{role.label}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{role.modules.filter(m => m.right !== "aucun").length}/{MODULES.length} modules</div>
              </div>
              {!role.isSystem && (
                <button onClick={e => { e.stopPropagation(); deleteRole(role.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: "2px" }}>×</button>
              )}
            </div>
          ))}
        </div>

        {/* Permissions panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Role header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: selectedRole.color }} />
                <h2 style={{ fontSize: 17, fontWeight: 600, color: "#111827" }}>{selectedRole.label}</h2>
                {selectedRole.isSystem && (
                  <span style={{ background: "#f3f4f6", color: "#6b7280", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>SYSTÈME</span>
                )}
              </div>
              <p style={{ fontSize: 13, color: "#6b7280" }}>{selectedRole.description}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {dirty && (
                <button onClick={saveRole} style={btnPrimary}>💾 Enregistrer</button>
              )}
            </div>
          </div>

          {/* Quick set */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 12, color: "#6b7280", marginRight: 4 }}>Tout mettre à :</span>
            {RIGHTS.map(r => (
              <button key={r.value} onClick={() => setAllRights(r.value)} style={{
                background: r.bg, color: r.color, border: `1px solid ${r.color}40`,
                borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>{r.label}</button>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
            {RIGHTS.map(r => (
              <div key={r.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: r.bg, border: `1px solid ${r.color}40` }} />
                <span style={{ fontSize: 11, color: "#6b7280" }}>{r.label}</span>
              </div>
            ))}
          </div>

          {/* Module table */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 140px 140px", padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", gap: 8 }}>
              <span>Module</span>
              {RIGHTS.map(r => <span key={r.value} style={{ textAlign: "center", color: r.color }}>{r.label}</span>)}
            </div>

            {MODULES.map((mod, i) => {
              const right = getRight(mod.id);
              return (
                <div key={mod.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 140px 140px 140px 140px",
                  padding: "12px 16px", gap: 8, alignItems: "center",
                  borderBottom: i < MODULES.length - 1 ? "1px solid #f3f4f6" : "none",
                  background: right !== "aucun" ? getRightStyle(right).bg + "60" : "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{mod.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{mod.label}</span>
                  </div>

                  {RIGHTS.map(r => (
                    <div key={r.value} style={{ textAlign: "center" }}>
                      <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <input
                          type="radio"
                          name={`module-${mod.id}`}
                          checked={right === r.value}
                          onChange={() => setModuleRight(mod.id, r.value)}
                          disabled={selectedRole.isSystem}
                          style={{ display: "none" }}
                        />
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", border: `2px solid ${right === r.value ? r.color : "#e5e7eb"}`,
                          background: right === r.value ? r.color : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: selectedRole.isSystem ? "not-allowed" : "pointer",
                          opacity: selectedRole.isSystem ? 0.6 : 1,
                          transition: "all .15s",
                        }}
                          onClick={() => !selectedRole.isSystem && setModuleRight(mod.id, r.value)}
                        >
                          {right === r.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {selectedRole.isSystem && (
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
              Les rôles système ne peuvent pas être modifiés. Dupliquez ce rôle pour le personnaliser.
            </p>
          )}
        </div>
      </div>

      {/* New role modal */}
      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Nouveau rôle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <F label="Nom du rôle *">
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex. Gestionnaire" style={{ ...inp, width: "100%" }} />
              </F>
              <F label="Description">
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description courte" style={{ ...inp, width: "100%" }} />
              </F>
              <F label="Couleur">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["#B8966A", "#0891b2", "#059669", "#dc2626", "#d97706", "#db2777"].map(c => (
                    <div key={c} onClick={() => setNewColor(c)} style={{
                      width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                      border: newColor === c ? `3px solid ${c}` : "3px solid transparent",
                      outline: newColor === c ? "2px solid white" : "none",
                      boxSizing: "border-box",
                    }} />
                  ))}
                </div>
              </F>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNew(false)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={createRole} style={{ ...btnPrimary, background: newColor }}>Créer le rôle</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{label}</div>{children}</div>;
}

const btnPrimary: React.CSSProperties = { background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const inp: React.CSSProperties = { height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
