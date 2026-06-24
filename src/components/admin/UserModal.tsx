"use client";
import { useState } from "react";
import { User, Role, avatarColor, getInitials } from "@/lib/admin";

interface Props {
  user: User | null;
  roles: Role[];
  onClose: () => void;
  onSave: (u: User) => void;
}

export default function UserModal({ user, roles, onClose, onSave }: Props) {
  const [f, setF] = useState({
    prenom: user?.prenom ?? "",
    nom: user?.nom ?? "",
    email: user?.email ?? "",
    password: user?.password ?? "",
    roleId: user?.roleId ?? roles[0]?.id ?? "",
    active: user?.active ?? true,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(k: string, v: string | boolean) { setF(prev => ({ ...prev, [k]: v })); }

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
      createdAt: user?.createdAt ?? new Date().toLocaleDateString("fr-FR"),
    });
  }

  function generatePassword() {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    const pwd = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    set("password", pwd);
  }

  const previewId = user?.id ?? "new";
  const ac = avatarColor(previewId);
  const role = roles.find(r => r.id === f.roleId);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 500, background: "#fff", borderRadius: 14, zIndex: 50,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: ac.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ac.text }}>
              {f.prenom || f.nom ? getInitials(f.prenom || "?", f.nom || "?") : "?"}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{user ? "Modifier" : "Nouvel"} utilisateur</div>
              {role && <div style={{ fontSize: 11, color: role.color, fontWeight: 500 }}>{role.label}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "60vh" }}>
          {/* Identité */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Prénom *" error={errors.prenom}>
              <input value={f.prenom} onChange={e => set("prenom", e.target.value)} placeholder="Jean" style={err(errors.prenom)} />
            </F>
            <F label="Nom *" error={errors.nom}>
              <input value={f.nom} onChange={e => set("nom", e.target.value)} placeholder="Dupont" style={err(errors.nom)} />
            </F>
          </div>

          <F label="Email (identifiant de connexion) *" error={errors.email}>
            <input type="email" value={f.email} onChange={e => set("email", e.target.value)} placeholder="jean.dupont@agence.fr" style={{ ...err(errors.email), width: "100%" }} />
          </F>

          <F label="Mot de passe *" error={errors.password}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={f.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Minimum 6 caractères"
                  style={{ ...err(errors.password), width: "100%", paddingRight: 36 }}
                />
                <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#9ca3af" }}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
              <button onClick={generatePassword} title="Générer un mot de passe" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 12px", fontSize: 12, background: "#f9fafb", cursor: "pointer", color: "#374151", whiteSpace: "nowrap" }}>
                🔐 Générer
              </button>
            </div>
            {f.password && f.password.length >= 6 && (
              <PasswordStrength password={f.password} />
            )}
          </F>

          <F label="Rôle *" error={errors.roleId}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roles.map(r => (
                <label key={r.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                  border: `1.5px solid ${f.roleId === r.id ? r.color : "#e5e7eb"}`,
                  borderRadius: 8, cursor: "pointer",
                  background: f.roleId === r.id ? r.color + "08" : "#fff",
                }}>
                  <input type="radio" name="role" value={r.id} checked={f.roleId === r.id} onChange={() => set("roleId", r.id)} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: f.roleId === r.id ? r.color : "#111827" }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{r.description}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                      {r.modules.filter(m => m.right !== "aucun").length} modules accessibles
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </F>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div onClick={() => set("active", !f.active)} style={{ width: 40, height: 22, borderRadius: 11, background: f.active ? "#7c3aed" : "#e5e7eb", position: "relative", cursor: "pointer", transition: "background .2s" }}>
              <div style={{ position: "absolute", top: 3, left: f.active ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </div>
            <span style={{ fontSize: 13, color: "#374151" }}>Compte {f.active ? "actif" : "inactif"}</span>
          </label>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {user ? "Enregistrer" : "Créer l'utilisateur"}
          </button>
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
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score] : "#e5e7eb" }} />
      ))}
      <span style={{ fontSize: 10, color: colors[score], fontWeight: 600, whiteSpace: "nowrap" }}>{labels[score]}</span>
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
