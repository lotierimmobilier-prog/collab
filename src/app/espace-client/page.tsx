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
  // Chat Auguste locataire
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [thinking, setThinking] = useState(false);

  async function ask(text?: string) {
    const content = (text ?? q).trim();
    if (!content || thinking) return;
    setQ("");
    const next = [...chat, { role: "user" as const, content }];
    setChat(next);
    setThinking(true);
    try {
      const r = await fetch("/api/client/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const d = await r.json().catch(() => ({}));
      setChat(c => [...c, { role: "assistant", content: d.reply || "Désolé, une erreur est survenue." }]);
    } catch { setChat(c => [...c, { role: "assistant", content: "Erreur réseau. Réessayez." }]); }
    finally { setThinking(false); }
  }

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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h1 style={{ fontSize: 18, color: DARK, margin: 0 }}>Bonjour {prenom} 👋</h1>
                <button onClick={logout} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>Déconnexion</button>
              </div>

              {/* Conversation Auguste */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "46vh", overflowY: "auto", padding: "4px 2px", marginBottom: 10 }}>
                {chat.length === 0 && (
                  <div style={{ background: "#FAF7F2", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#3f3a33", lineHeight: 1.6 }}>
                    Je suis <strong style={{ color: GOLD }}>Auguste</strong>, votre assistant. Posez-moi une question sur votre dossier — par exemple :
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                      {["Quel est mon solde de loyer ?", "Ai-je un rendez-vous prévu ?", "Je veux signaler un problème"].map(s => (
                        <button key={s} onClick={() => ask(s)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, color: DARK, cursor: "pointer" }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 12px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.role === "user" ? GOLD : "#f3f4f6", color: m.role === "user" ? "#fff" : DARK, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.content}</div>
                ))}
                {thinking && <div style={{ alignSelf: "flex-start", padding: "9px 12px", borderRadius: 12, background: "#f3f4f6", color: "#9ca3af", fontSize: 13 }}>Auguste réfléchit…</div>}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Écrivez à Auguste…" disabled={thinking}
                  style={{ ...inp, height: 42, fontSize: 14 }} />
                <button onClick={() => ask()} disabled={thinking || !q.trim()} style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 10, border: "none", background: thinking || !q.trim() ? "#e5e7eb" : GOLD, color: "#fff", fontSize: 17, cursor: thinking || !q.trim() ? "default" : "pointer" }}>↑</button>
              </div>
              <div style={{ fontSize: 10.5, color: "#bcb3a3", textAlign: "center", marginTop: 8 }}>🔒 Espace strictement personnel — vous n'accédez qu'à votre dossier.</div>
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
