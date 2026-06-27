"use client";
import { useState } from "react";
import { User, Role, ModuleAccess, Right, MODULES, RIGHTS, avatarColor, getInitials, getRightStyle, getUserRight } from "@/lib/admin";
import { isAdminRole, isSuperAdminEmail } from "@/lib/superadmin";

interface Props {
  user: User | null;
  roles: Role[];
  allUsers?: User[];
  isSuper?: boolean;
  onClose: () => void;
  onSave: (u: User) => void;
}

export default function UserModal({ user, roles, allUsers = [], isSuper = false, onClose, onSave }: Props) {
  const [tab, setTab] = useState<"infos" | "acces">("infos");
  const [f, setF] = useState({
    prenom: user?.prenom ?? "",
    nom: user?.nom ?? "",
    email: user?.email ?? "",
    password: user?.password ?? "",
    roleId: user?.roleId ?? roles[0]?.id ?? "",
    active: user?.active ?? true,
    isEmployee: (user as { isEmployee?: boolean } | null)?.isEmployee ?? false,
    city: (user as { city?: string } | null)?.city ?? "",
    gedAccess: (user as { gedAccess?: string } | null)?.gedAccess ?? "",
    parrainId: (user as { parrainId?: string } | null)?.parrainId ?? "",
    superAdmin: (user as { superAdmin?: boolean } | null)?.superAdmin ?? false,
  });
  const bootstrapSuper = isSuperAdminEmail(user?.email);
  const [overrides, setOverrides] = useState<ModuleAccess[]>(user?.accessOverrides ?? []);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(k: string, v: string | boolean) { setF(prev => ({ ...prev, [k]: v })); }

  const currentRole = roles.find(r => r.id === f.roleId);

  function getRoleRight(moduleId: string): Right {
    return currentRole?.modules.find(m => m.moduleId === moduleId)?.right ?? "aucun";
  }

  function getEffectiveRight(moduleId: string): Right {
    const ov = overrides.find(o => o.moduleId === moduleId);
    return ov ? ov.right : getRoleRight(moduleId);
  }

  function setOverride(moduleId: string, right: Right) {
    const roleRight = getRoleRight(moduleId);
    if (right === roleRight) {
      // Identique au rôle → supprimer l'override
      setOverrides(prev => prev.filter(o => o.moduleId !== moduleId));
    } else {
      setOverrides(prev => {
        const exists = prev.find(o => o.moduleId === moduleId);
        if (exists) return prev.map(o => o.moduleId === moduleId ? { ...o, right } : o);
        return [...prev, { moduleId, right }];
      });
    }
  }

  function resetAllOverrides() { setOverrides([]); }

  function validate() {
    const e: Record<string, string> = {};
    if (!f.prenom.trim()) e.prenom = "Requis";
    if (!f.nom.trim()) e.nom = "Requis";
    if (!f.email.trim() || !f.email.includes("@")) e.email = "Email invalide";
    if (!f.password || f.password.length < 6) e.password = "Minimum 6 caractères";
    if (!f.roleId) e.roleId = "Requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({
      id: user?.id ?? Date.now().toString(),
      prenom: f.prenom.trim(),
      nom: f.nom.trim(),
      email: f.email.trim().toLowerCase(),
      password: f.password,
      roleId: f.roleId,
      active: f.active,
      isEmployee: f.isEmployee,
      city: f.city || null,
      createdAt: user?.createdAt ?? new Date().toLocaleDateString("fr-FR"),
      accessOverrides: overrides.length > 0 ? overrides : undefined,
      gedAccess: f.gedAccess || null,
      parrainId: f.parrainId || null,
      superAdmin: f.superAdmin,
    } as User);
  }

  function generatePassword() {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    set("password", Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  }

  const ac = avatarColor(user?.id ?? "new");

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 560, maxHeight: "88vh", background: "#fff", borderRadius: 16, zIndex: 50,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: ac.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ac.text }}>
              {f.prenom || f.nom ? getInitials(f.prenom || "?", f.nom || "?") : "?"}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</div>
              {currentRole && <div style={{ fontSize: 11, color: currentRole.color, fontWeight: 500 }}>{currentRole.label} {overrides.length > 0 && `· ${overrides.length} accès personnalisé(s)`}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "0 20px" }}>
          {[{ id: "infos", label: "Informations" }, { id: "acces", label: `Accès & permissions ${overrides.length > 0 ? `(${overrides.length})` : ""}` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as "infos" | "acces")} style={{
              background: "none", border: "none", cursor: "pointer", padding: "10px 16px", fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "#B8966A" : "#6b7280",
              borderBottom: tab === t.id ? "2px solid #B8966A" : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {tab === "infos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Prénom *" error={errors.prenom}>
                  <input value={f.prenom} onChange={e => set("prenom", e.target.value)} placeholder="Jean" style={err(errors.prenom)} />
                </F>
                <F label="Nom *" error={errors.nom}>
                  <input value={f.nom} onChange={e => set("nom", e.target.value)} placeholder="Dupont" style={err(errors.nom)} />
                </F>
              </div>

              <F label="Email (identifiant de connexion) *" error={errors.email}>
                <input type="email" value={f.email} onChange={e => set("email", e.target.value)} placeholder="jean.dupont@agence.fr" style={{ ...err(errors.email), width: "100%", boxSizing: "border-box" }} />
              </F>

              <F label="Mot de passe *" error={errors.password}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input type={showPwd ? "text" : "password"} value={f.password} onChange={e => set("password", e.target.value)} placeholder="Minimum 6 caractères" style={{ ...err(errors.password), width: "100%", paddingRight: 36, boxSizing: "border-box" }} />
                    <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#9ca3af" }}>
                      {showPwd ? "🙈" : "👁"}
                    </button>
                  </div>
                  <button onClick={generatePassword} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 12px", fontSize: 12, background: "#f9fafb", cursor: "pointer", color: "#374151", whiteSpace: "nowrap" }}>
                    🔐 Générer
                  </button>
                </div>
                {f.password && f.password.length >= 6 && <PasswordStrength password={f.password} />}
              </F>

              <F label="Rôle *" error={errors.roleId}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {roles.map(r => {
                    // Seul le super admin peut attribuer un rôle d'administrateur.
                    const roleLocked = !isSuper && isAdminRole(r.id) && f.roleId !== r.id;
                    return (
                    <label key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: `1.5px solid ${f.roleId === r.id ? r.color : "#e5e7eb"}`, borderRadius: 8, cursor: roleLocked ? "not-allowed" : "pointer", background: f.roleId === r.id ? r.color + "08" : "#fff", opacity: roleLocked ? 0.5 : 1 }}>
                      <input type="radio" name="role" value={r.id} disabled={roleLocked} checked={f.roleId === r.id} onChange={() => { set("roleId", r.id); setOverrides([]); }} style={{ marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: f.roleId === r.id ? r.color : "#111827" }}>{r.label}{roleLocked && <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>· réservé au super admin</span>}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{r.description}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{r.modules.filter(m => m.right !== "aucun").length} modules accessibles</div>
                      </div>
                      {f.roleId === r.id && (
                        <button type="button" onClick={e => { e.preventDefault(); setTab("acces"); }} style={{ fontSize: 11, color: r.color, background: "none", border: `1px solid ${r.color}30`, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                          Personnaliser →
                        </button>
                      )}
                    </label>
                    );
                  })}
                </div>
              </F>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div onClick={() => set("active", !f.active)} style={{ width: 40, height: 22, borderRadius: 11, background: f.active ? "#B8966A" : "#e5e7eb", position: "relative", cursor: "pointer", transition: "background .2s" }}>
                  <div style={{ position: "absolute", top: 3, left: f.active ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </div>
                <span style={{ fontSize: 13, color: "#374151" }}>Compte {f.active ? "actif" : "inactif"}</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div onClick={() => set("isEmployee", !f.isEmployee)} style={{ width: 40, height: 22, borderRadius: 11, background: f.isEmployee ? "#B8966A" : "#e5e7eb", position: "relative", cursor: "pointer", transition: "background .2s" }}>
                  <div style={{ position: "absolute", top: 3, left: f.isEmployee ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </div>
                <span style={{ fontSize: 13, color: "#374151" }}>
                  Salarié de l’agence
                  <span style={{ display: "block", fontSize: 11, color: "#9ca3af" }}>Ouvre le module RH (décompte d’heures, congés)</span>
                </span>
              </label>

              {/* Super administrateur — réservé au super admin (gouvernance des admins) */}
              {isSuper && (
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: bootstrapSuper ? "not-allowed" : "pointer", opacity: bootstrapSuper ? 0.6 : 1 }}>
                  <div onClick={() => { if (!bootstrapSuper) set("superAdmin", !f.superAdmin); }} style={{ width: 40, height: 22, borderRadius: 11, background: f.superAdmin ? "#1C1A17" : "#e5e7eb", position: "relative", cursor: bootstrapSuper ? "not-allowed" : "pointer", transition: "background .2s" }}>
                    <div style={{ position: "absolute", top: 3, left: f.superAdmin ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: f.superAdmin ? "#D8B783" : "#fff", transition: "left .2s" }} />
                  </div>
                  <span style={{ fontSize: 13, color: "#374151" }}>
                    Super administrateur ★
                    <span style={{ display: "block", fontSize: 11, color: "#9ca3af" }}>
                      {bootstrapSuper ? "Super administrateur d’origine (statut permanent)." : "Peut créer des administrateurs et définir leurs droits."}
                    </span>
                  </span>
                </label>
              )}

              {/* Ville de résidence (météo du tableau de bord) */}
              <F label="Ville de résidence">
                <input value={f.city} onChange={e => set("city", e.target.value)} style={{ ...inp, width: "100%" }} placeholder="ex. Bordeaux" />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  Affiche la météo locale et les prévisions sur le tableau de bord.
                </div>
              </F>

              {/* Parrain (formation par parrainage) */}
              <F label="Parrain (formation)">
                <select value={f.parrainId} onChange={e => set("parrainId", e.target.value)} style={{ ...inp, width: "100%" }}>
                  <option value="">— Aucun (pas de parrainage) —</option>
                  {allUsers.filter(u => u.id !== user?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  Associez un parrain pour débloquer l’espace de formation de ce filleul. Modifiable aussi dans Formation → onglet « Parrains ».
                </div>
              </F>
            </div>
          )}

          {tab === "acces" && (
            <div>
              {/* Légende */}
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Niveaux d'accès</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {RIGHTS.map(r => (
                    <span key={r.value} style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}30`, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{r.label}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                  Les accès personnalisés <strong>surchargent</strong> ceux du rôle pour cet utilisateur uniquement.
                </div>
              </div>

              {/* Info rôle courant */}
              {currentRole && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Rôle : <span style={{ fontWeight: 600, color: currentRole.color }}>{currentRole.label}</span>
                    {overrides.length > 0 && <span style={{ color: "#B8966A", marginLeft: 8 }}>· {overrides.length} accès personnalisé(s)</span>}
                  </div>
                  {overrides.length > 0 && (
                    <button onClick={resetAllOverrides} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "1px solid #fecaca", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>
                      Réinitialiser tout
                    </button>
                  )}
                </div>
              )}

              {/* Accès GED ICS */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 14, background: "#FAFAF8" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1A17" }}>📁 Documents ICS (GED)</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Par défaut : direction/gestion = complet, commercial = bail + EDL, autres = aucun.</div>
                  </div>
                  <select value={f.gedAccess} onChange={e => set("gedAccess", e.target.value)}
                    style={{ height: 34, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, background: "#fff", minWidth: 200 }}>
                    <option value="">Selon le rôle (défaut)</option>
                    <option value="complet">Complet — toute la GED</option>
                    <option value="restreint">Restreint — bail + état des lieux</option>
                    <option value="aucun">Aucun accès</option>
                  </select>
                </div>
              </div>

              {/* Tableau des modules */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>
                  <span>Module</span>
                  <span style={{ minWidth: 280, textAlign: "center" }}>Niveau d'accès</span>
                </div>

                {MODULES.map((mod, i) => {
                  const roleRight = getRoleRight(mod.id);
                  const effective = getEffectiveRight(mod.id);
                  const hasOverride = overrides.some(o => o.moduleId === mod.id);

                  return (
                    <div key={mod.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "11px 14px", borderBottom: i < MODULES.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", background: hasOverride ? "#faf5ff" : "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{mod.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{mod.label}</div>
                          {hasOverride && (
                            <div style={{ fontSize: 10, color: "#B8966A", marginTop: 1 }}>
                              Personnalisé · rôle : <span style={{ fontWeight: 600 }}>{getRightStyle(roleRight).label}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {RIGHTS.map(r => {
                          const isEffective = effective === r.value;
                          const isRole = roleRight === r.value && !hasOverride;
                          return (
                            <button
                              key={r.value}
                              onClick={() => setOverride(mod.id, r.value)}
                              title={r.label + (isRole ? " (rôle)" : "")}
                              style={{
                                padding: "4px 10px", fontSize: 11, fontWeight: isEffective ? 700 : 400,
                                border: `1.5px solid ${isEffective ? r.color : "#e5e7eb"}`,
                                borderRadius: 6, cursor: "pointer",
                                background: isEffective ? r.bg : "#fff",
                                color: isEffective ? r.color : "#9ca3af",
                                position: "relative",
                              }}
                            >
                              {r.label}
                              {isRole && !hasOverride && isEffective && (
                                <span style={{ position: "absolute", top: -4, right: -4, width: 7, height: 7, borderRadius: "50%", background: "#9ca3af", border: "1px solid #fff" }} />
                              )}
                            </button>
                          );
                        })}
                        {hasOverride && (
                          <button onClick={() => setOverrides(p => p.filter(o => o.moduleId !== mod.id))} title="Revenir au droit du rôle" style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 6px", fontSize: 11, cursor: "pointer", color: "#dc2626" }}>↺</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Résumé */}
              <div style={{ marginTop: 14, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Résumé des accès effectifs</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {MODULES.map(mod => {
                    const right = getEffectiveRight(mod.id);
                    if (right === "aucun") return null;
                    const s = getRightStyle(right);
                    const hasOv = overrides.some(o => o.moduleId === mod.id);
                    return (
                      <span key={mod.id} style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30`, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
                        {mod.icon} {mod.label} {hasOv ? "★" : ""}
                      </span>
                    );
                  })}
                  {MODULES.every(m => getEffectiveRight(m.id) === "aucun") && (
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Aucun accès accordé</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>★ = accès personnalisé (différent du rôle)</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {overrides.length > 0 ? `${overrides.length} accès personnalisé(s)` : "Accès par défaut du rôle"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={submit} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              {user ? "Enregistrer" : "Créer l'utilisateur"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PasswordStrength({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Faible", "Moyen", "Bon", "Fort", "Très fort"];
  const colors = ["#dc2626", "#f59e0b", "#f59e0b", "#10b981", "#10b981"];
  return (
    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
      {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score] : "#e5e7eb" }} />)}
      <span style={{ fontSize: 10, color: colors[score], fontWeight: 600 }}>{labels[score]}</span>
    </div>
  );
}

function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>{label}</div>
      {children}
      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
    </div>
  );
}

const inp: React.CSSProperties = { height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const errInp: React.CSSProperties = { ...inp, borderColor: "#fca5a5", background: "#fff5f5" };
function err(e?: string): React.CSSProperties { return e ? errInp : inp; }
