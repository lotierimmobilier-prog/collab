"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Remplissez tous les champs"); return; }
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email ou mot de passe incorrect");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F3F1EC", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "48px 40px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.08)", width: 380,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 160, marginBottom: 12 }} />
          <div style={{ fontSize: 12, color: "#A09880", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Espace de gestion
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            width: "100%", background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, boxSizing: "border-box",
          }}>
            <div style={{ fontSize: 13, color: "#dc2626" }}>{error}</div>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#5C5449", marginBottom: 5 }}>
              Adresse email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.fr" autoComplete="email" required
              style={{
                width: "100%", height: 40, border: "1.5px solid #E6E1D9", borderRadius: 8,
                padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
                background: "#FAFAF8", fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#5C5449", marginBottom: 5 }}>
              Mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" required
                style={{
                  width: "100%", height: 40, border: "1.5px solid #E6E1D9", borderRadius: 8,
                  padding: "0 40px 0 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
                  background: "#FAFAF8", fontFamily: "inherit",
                }}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#A09880",
              }}>
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            marginTop: 6, width: "100%", height: 42,
            background: loading ? "#D4B98A" : "#B8966A",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.02em", transition: "background 0.2s",
          }}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div style={{ fontSize: 11, color: "#C4B99A", textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
          Accès réservé aux membres de l'équipe.<br />
          Contactez votre administrateur pour obtenir vos identifiants.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
