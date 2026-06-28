"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";

type Step = "loading" | "email" | "code" | "in";

export default function EspaceClientPage() {
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [prenom, setPrenom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/client/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.client) { setPrenom(d.client.prenom || ""); setStep("in"); }
      else setStep("email");
    }).catch(() => setStep("email"));
  }, []);

  async function requestCode() {
    if (!email.trim()) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/client/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Erreur."); return; }
      setMsg(d.message || "Code envoyé.");
      setStep("code");
    } catch { setErr("Erreur réseau."); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code.trim())) { setErr("Entrez le code à 6 chiffres."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/client/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Code invalide."); return; }
      setPrenom(d.client?.prenom || ""); setStep("in");
    } catch { setErr("Erreur réseau."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/client/auth/logout", { method: "POST" }).catch(() => {});
    setEmail(""); setCode(""); setPrenom(""); setMsg(""); setStep("email");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* En-tête logo */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 190, maxWidth: "70%", height: "auto" }} />
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: GOLD, marginTop: 10 }}>Espace locataire</div>
        </div>

        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          {step === "loading" && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 20 }}>Chargement…</div>}

          {step === "email" && (
            <>
              <h1 style={{ fontSize: 18, color: DARK, margin: "0 0 6px" }}>Connexion</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.5 }}>Saisissez l'adresse email de votre dossier locataire. Vous recevrez un code à usage unique.</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && requestCode()}
                placeholder="votre@email.com" autoFocus style={inp} />
              {err && <div style={errBox}>{err}</div>}
              <button onClick={requestCode} disabled={busy || !email.trim()} style={btn(busy || !email.trim())}>{busy ? "Envoi…" : "Recevoir mon code"}</button>
            </>
          )}

          {step === "code" && (
            <>
              <h1 style={{ fontSize: 18, color: DARK, margin: "0 0 6px" }}>Code de connexion</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.5 }}>{msg} Entrez le code à 6 chiffres reçu sur <strong>{email}</strong>.</p>
              <input inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => e.key === "Enter" && verifyCode()}
                placeholder="••••••" autoFocus style={{ ...inp, textAlign: "center", letterSpacing: 8, fontSize: 22 }} />
              {err && <div style={errBox}>{err}</div>}
              <button onClick={verifyCode} disabled={busy || code.length < 6} style={btn(busy || code.length < 6)}>{busy ? "Vérification…" : "Me connecter"}</button>
              <button onClick={() => { setStep("email"); setCode(""); setErr(""); }} style={linkBtn}>← Changer d'adresse</button>
            </>
          )}

          {step === "in" && (
            <>
              <h1 style={{ fontSize: 19, color: DARK, margin: "0 0 8px" }}>Bonjour {prenom} 👋</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.6 }}>
                Bienvenue dans votre espace locataire. Votre assistant <strong style={{ color: GOLD }}>Auguste</strong> arrive très bientôt : vous pourrez consulter votre solde de loyer, vos documents, vos rendez-vous et faire une demande.
              </p>
              <div style={{ background: "#FAF7F2", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", fontSize: 12.5, color: "#6b7280" }}>
                🔒 Votre espace est strictement personnel : vous n'accédez qu'aux informations de votre propre dossier.
              </div>
              <button onClick={logout} style={{ ...linkBtn, marginTop: 18 }}>Se déconnecter</button>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#bcb3a3", marginTop: 16 }}>© Lotier Immobilier</div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 44, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0 14px", fontSize: 15, outline: "none", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" };
const errBox: React.CSSProperties = { color: "#dc2626", fontSize: 12.5, marginTop: 10 };
function btn(disabled: boolean): React.CSSProperties {
  return { width: "100%", marginTop: 14, height: 44, background: disabled ? "#e5e7eb" : GOLD, color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 600, cursor: disabled ? "default" : "pointer" };
}
const linkBtn: React.CSSProperties = { width: "100%", marginTop: 10, background: "none", border: "none", color: "#9ca3af", fontSize: 12.5, cursor: "pointer" };
