"use client";
import { useState, useEffect } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const RED = "#DC2626"; const GREEN = "#2F855A";

export default function SetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "invalid" | "form" | "done">("loading");
  const [prenom, setPrenom] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    if (!t) { setPhase("invalid"); return; }
    setToken(t);
    fetch(`/api/set-password?token=${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => { if (d?.ok) { setPrenom(d.prenom || ""); setPhase("form"); } else setPhase("invalid"); })
      .catch(() => setPhase("invalid"));
  }, []);

  const submit = async () => {
    setErr("");
    if (pw.length < 8) { setErr("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (pw !== pw2) { setErr("Les deux mots de passe ne correspondent pas."); return; }
    setSaving(true);
    const d = await fetch("/api/set-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pw }),
    }).then(r => r.json()).catch(() => null);
    setSaving(false);
    if (d?.ok) setPhase("done");
    else setErr(d?.error || "Une erreur est survenue. Le lien a peut-être expiré.");
  };

  const champ: React.CSSProperties = { width: "100%", padding: "11px 13px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 15, boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(440px,100%)", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: 30, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 180, maxWidth: "60%", height: "auto" }} />
        </div>

        {phase === "loading" && <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Vérification du lien…</p>}

        {phase === "invalid" && (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: DARK }}>Lien invalide ou expiré</h1>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>Ce lien de création de mot de passe n'est plus valable. Demandez à votre administrateur de vous en renvoyer un.</p>
            <a href="/login" style={{ display: "inline-block", marginTop: 12, color: GOLD, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Aller à la connexion →</a>
          </div>
        )}

        {phase === "form" && (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: DARK, margin: "0 0 4px", textAlign: "center" }}>Bienvenue{prenom ? ` ${prenom}` : ""} 👋</h1>
            <p style={{ fontSize: 13.5, color: "#6b7280", textAlign: "center", margin: "0 0 22px", lineHeight: 1.6 }}>Créez votre mot de passe pour activer votre accès à Collab.</p>

            <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 5 }}>Nouveau mot de passe</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Au moins 8 caractères" style={{ ...champ, marginBottom: 12 }} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 5 }}>Confirmer le mot de passe</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Retapez le mot de passe" style={champ} onKeyDown={e => { if (e.key === "Enter") submit(); }} />

            {err && <p style={{ color: RED, fontSize: 13, marginTop: 12, marginBottom: 0 }}>{err}</p>}

            <button onClick={submit} disabled={saving} style={{
              width: "100%", marginTop: 18, background: saving ? "#d1d5db" : GOLD, color: "#fff", border: "none",
              borderRadius: 11, padding: "13px", fontSize: 15, fontWeight: 800, cursor: saving ? "default" : "pointer",
            }}>{saving ? "Enregistrement…" : "Activer mon accès"}</button>
          </div>
        )}

        {phase === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: GREEN, margin: "0 0 6px" }}>Accès activé !</h1>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: "0 0 18px" }}>Votre mot de passe est enregistré. Vous pouvez maintenant vous connecter à Collab.</p>
            <a href="/login" style={{ display: "inline-block", background: GOLD, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 15, padding: "12px 26px", borderRadius: 11 }}>Se connecter</a>
          </div>
        )}
      </div>
    </div>
  );
}
