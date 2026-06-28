"use client";
import { useEffect, useState, useRef } from "react";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";
const BG = "#F7F4EF";

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
      setMsg(d.message || "Code envoyé."); setStep("code");
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

  if (step === "in") return <Portal prenom={prenom} onLogout={logout} />;

  // ── Écran de connexion ──
  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
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
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && requestCode()} placeholder="votre@email.com" autoFocus style={inp} />
              {err && <div style={errBox}>{err}</div>}
              <button onClick={requestCode} disabled={busy || !email.trim()} style={btn(busy || !email.trim())}>{busy ? "Envoi…" : "Recevoir mon code"}</button>
            </>
          )}
          {step === "code" && (
            <>
              <h1 style={{ fontSize: 18, color: DARK, margin: "0 0 6px" }}>Code de connexion</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.5 }}>{msg} Entrez le code à 6 chiffres reçu sur <strong>{email}</strong>.</p>
              <input inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => e.key === "Enter" && verifyCode()} placeholder="••••••" autoFocus style={{ ...inp, textAlign: "center", letterSpacing: 8, fontSize: 22 }} />
              {err && <div style={errBox}>{err}</div>}
              <button onClick={verifyCode} disabled={busy || code.length < 6} style={btn(busy || code.length < 6)}>{busy ? "Vérification…" : "Me connecter"}</button>
              <button onClick={() => { setStep("email"); setCode(""); setErr(""); }} style={linkBtn}>← Changer d'adresse</button>
            </>
          )}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#bcb3a3", marginTop: 16 }}>© Lotier Immobilier</div>
      </div>
    </div>
  );
}

// ════════════ Portail (après connexion) ════════════
interface Doc { id: string; source: string; category: string; fileName: string; mime: string | null; size: number | null; createdAt: string; validUntil?: string | null }
const TABS = [
  { id: "accueil", label: "Accueil", icon: "⌂" },
  { id: "documents", label: "Mes documents", icon: "📄" },
  { id: "justificatifs", label: "Mes justificatifs", icon: "⬆" },
  { id: "demandes", label: "Mes demandes", icon: "✉" },
  { id: "auguste", label: "Auguste", icon: "✦" },
];

function Portal({ prenom, onLogout }: { prenom: string; onLogout: () => void }) {
  const [tab, setTab] = useState("accueil");
  const [docs, setDocs] = useState<Doc[]>([]);
  const loadDocs = () => fetch("/api/client/documents").then(r => r.json()).then(d => setDocs(d.documents || [])).catch(() => {});
  useEffect(() => { loadDocs(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* En-tête */}
      <header style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Lotier" style={{ height: 30, width: "auto" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD }}>Espace locataire</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bonjour {prenom}</div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, color: "#6b7280", cursor: "pointer" }}>Déconnexion</button>
      </header>

      {/* Onglets */}
      <nav style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 2, padding: "0 12px", overflowX: "auto", position: "sticky", top: 55, zIndex: 9 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? GOLD : "transparent"}`,
            padding: "12px 14px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? GOLD : "#6b7280",
            cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px 40px" }}>
        {tab === "accueil" && <Accueil prenom={prenom} onTab={setTab} />}
        {tab === "documents" && <Documents docs={docs} />}
        {tab === "justificatifs" && <Justificatifs docs={docs} reload={loadDocs} />}
        {tab === "demandes" && <Demandes onTab={setTab} />}
        {tab === "auguste" && <Auguste />}
      </main>
    </div>
  );
}

function Card({ children, title, sub }: { children: React.ReactNode; title?: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
      {title && <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: sub ? 2 : 10 }}>{title}</div>}
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

interface Weather { city: string; current: { temp: number; label: string; emoji: string }; daily: { date: string; tmin: number; tmax: number; emoji: string }[]; conseils: string[] }

function Accueil({ prenom, onTab }: { prenom: string; onTab: (t: string) => void }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [wState, setWState] = useState<"loading" | "ok" | "needsCity" | "error">("loading");
  const [cityInput, setCityInput] = useState("");
  const [savingCity, setSavingCity] = useState(false);

  const loadWeather = () => {
    setWState("loading");
    fetch("/api/client/weather").then(r => r.json()).then(d => {
      if (d?.current) { setWeather(d); setWState("ok"); }
      else if (d?.needsCity) setWState("needsCity");
      else setWState("error");
    }).catch(() => setWState("error"));
  };
  useEffect(() => { loadWeather(); }, []);

  async function saveCity() {
    if (!cityInput.trim()) return;
    setSavingCity(true);
    try {
      const r = await fetch("/api/client/city", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: cityInput.trim() }) });
      if (r.ok) { setCityInput(""); loadWeather(); }
    } catch { /* silencieux */ }
    finally { setSavingCity(false); }
  }

  const tiles = [
    { id: "documents", icon: "📄", t: "Mes documents", d: "Bail, état des lieux, quittances, attestation de loyer…" },
    { id: "justificatifs", icon: "⬆", t: "Déposer un justificatif", d: "Assurance habitation, entretien chaudière/climatisation…" },
    { id: "demandes", icon: "✉", t: "Mes demandes", d: "Suivre l'état de mes demandes : reçue, en cours, traitée." },
    { id: "auguste", icon: "✦", t: "Demander à Auguste", d: "Mon solde, mes rendez-vous, signaler un problème…" },
  ];
  const dayName = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short" });
  return (
    <>
      <Card>
        <div style={{ fontSize: 17, fontWeight: 700, color: DARK }}>Bienvenue {prenom} 👋</div>
        <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.6, margin: "8px 0 0" }}>
          Votre portail locataire Lotier Immobilier : retrouvez vos documents, déposez vos justificatifs et posez vos questions à Auguste. Votre espace est strictement personnel.
        </p>
      </Card>

      {/* Météo : toujours présente, avec saisie de ville en secours */}
      {wState === "loading" && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 14, fontSize: 13, color: "#9ca3af" }}>🌦️ Météo en cours de chargement…</div>
      )}
      {(wState === "needsCity" || wState === "error") && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4 }}>🌦️ Météo de votre logement</div>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
            {wState === "needsCity" ? "Indiquez votre ville pour afficher la météo et des conseils adaptés à votre logement." : "Météo momentanément indisponible. Indiquez votre ville pour réessayer."}
          </div>
          <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
            <input value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCity()} placeholder="ex. Carcassonne" style={{ flex: 1, height: 42, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0 14px", fontSize: 14, outline: "none", background: "#fff" }} />
            <button onClick={saveCity} disabled={savingCity || !cityInput.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{savingCity ? "…" : "Valider"}</button>
          </div>
        </div>
      )}
      {wState === "ok" && weather && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>{weather.current.emoji}</div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: DARK }}>{weather.current.temp}°</div>
              <div style={{ fontSize: 12.5, color: "#6b7280" }}>{weather.current.label} · {weather.city}</div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {weather.daily.slice(1, 3).map(d => (
                <div key={d.date} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "capitalize" }}>{dayName(d.date)}</div>
                  <div style={{ fontSize: 18 }}>{d.emoji}</div>
                  <div style={{ fontSize: 11.5, color: DARK }}>{d.tmax}° <span style={{ color: "#9ca3af" }}>{d.tmin}°</span></div>
                </div>
              ))}
            </div>
          </div>
          {weather.conseils.length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 6 }}>💡 Conseils pour votre logement</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                {weather.conseils.map((c, i) => <li key={i} style={{ fontSize: 12.5, color: "#3f3a33", lineHeight: 1.5 }}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {tiles.map(x => (
          <button key={x.id} onClick={() => onTab(x.id)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, cursor: "pointer", display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ width: 42, height: 42, borderRadius: 10, background: "#F7F0E6", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{x.icon}</span>
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: DARK }}>{x.t}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "#9ca3af", marginTop: 2 }}>{x.d}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Documents({ docs }: { docs: Doc[] }) {
  const agency = docs.filter(d => d.source === "agency");
  return (
    <>
      <Card title="Attestation de loyer" sub="Générée à partir de votre dossier — pour la CAF ou toute démarche.">
        <a href="/api/client/attestation-loyer" target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GOLD, color: "#fff", textDecoration: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 600 }}>
          📄 Obtenir mon attestation de loyer
        </a>
      </Card>
      <Card title="Documents de l'agence" sub="Bail, état des lieux, quittances et autres documents mis à disposition par Lotier Immobilier.">
        {agency.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>Aucun document mis à disposition pour le moment. Votre conseiller peut en ajouter ; ils apparaîtront ici.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {agency.map(d => <DocRow key={d.id} d={d} />)}
          </div>
        )}
      </Card>
    </>
  );
}

function Justificatifs({ docs, reload }: { docs: Doc[]; reload: () => void }) {
  const mine = docs.filter(d => d.source === "tenant");
  const [category, setCategory] = useState("assurance");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setErr("");
    if (file.size > 10 * 1024 * 1024) { setErr("Fichier trop volumineux (max 10 Mo)."); return; }
    setBusy(true);
    try {
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
      const r = await fetch("/api/client/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, fileName: file.name, mime: file.type, size: file.size, data, validUntil: category === "assurance" && validUntil ? validUntil : undefined }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Échec du dépôt."); return; }
      reload();
    } catch { setErr("Erreur lors du dépôt."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce justificatif ?")) return;
    await fetch(`/api/client/documents/${id}`, { method: "DELETE" }).catch(() => {});
    reload();
  }

  const CATS = [
    { id: "assurance", label: "Attestation d'assurance habitation" },
    { id: "chaudiere", label: "Entretien chaudière" },
    { id: "climatisation", label: "Entretien climatisation" },
    { id: "autre", label: "Autre justificatif" },
  ];

  return (
    <>
      <Card title="Déposer un justificatif" sub="Attestation d'assurance, entretien chaudière/climatisation… (PDF, JPG, PNG — max 10 Mo). Votre agence y a accès.">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, height: 42 }}>
            {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {category === "assurance" && (
            <label style={{ fontSize: 12.5, color: "#6b6357", display: "flex", flexDirection: "column", gap: 4 }}>
              Date de fin de validité de l'attestation (facultatif)
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={{ ...inp, height: 42 }} />
            </label>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} disabled={busy} style={{ fontSize: 13 }} />
          {busy && <div style={{ fontSize: 12.5, color: GOLD }}>Dépôt en cours…</div>}
          {err && <div style={{ fontSize: 12.5, color: "#dc2626" }}>{err}</div>}
        </div>
      </Card>
      <Card title="Mes justificatifs déposés">
        {mine.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>Vous n'avez encore déposé aucun justificatif.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mine.map(d => <DocRow key={d.id} d={d} onDelete={() => del(d.id)} />)}
          </div>
        )}
      </Card>
    </>
  );
}

const CAT_LABEL: Record<string, string> = {
  assurance: "Assurance habitation", chaudiere: "Entretien chaudière", climatisation: "Entretien climatisation",
  bail: "Bail", etat_lieux: "État des lieux", quittance: "Quittance", attestation_loyer: "Attestation de loyer", caf: "Document CAF", autre: "Document",
};
function fmtSize(n: number | null) { if (!n) return ""; return n < 1024 * 1024 ? `${Math.round(n / 1024)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`; }

function DocRow({ d, onDelete }: { d: Doc; onDelete?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ fontSize: 18 }}>📎</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fileName}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>{CAT_LABEL[d.category] || "Document"} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}{d.size ? ` · ${fmtSize(d.size)}` : ""}</div>
        {d.category === "assurance" && d.validUntil && <div style={{ fontSize: 11, color: new Date(d.validUntil) < new Date() ? "#dc2626" : "#6b6357", marginTop: 1 }}>Valable jusqu'au {new Date(d.validUntil).toLocaleDateString("fr-FR")}</div>}
      </div>
      <a href={`/api/client/documents/${d.id}`} title="Télécharger" style={{ textDecoration: "none", color: GOLD, fontWeight: 700, fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 10px" }}>↓</a>
      {onDelete && <button onClick={onDelete} title="Supprimer" style={{ background: "none", border: `1px solid #fecaca`, borderRadius: 8, padding: "6px 9px", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>🗑</button>}
    </div>
  );
}

interface TenantRequest { ref: string; description: string | null; status: string; statusLabel: string; statusColor: string; step: number; createdAt: string; updatedAt: string }

function Demandes({ onTab }: { onTab: (t: string) => void }) {
  const [reqs, setReqs] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/client/requests").then(r => r.json()).then(d => setReqs(d.requests ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const STEPS = ["Reçue", "En cours", "Traitée"];

  return (
    <Card title="Mes demandes" sub="Suivez l'état des demandes que vous avez envoyées à l'agence (via Auguste).">
      {loading ? (
        <div style={{ fontSize: 13, color: "#9ca3af", padding: "10px 0" }}>Chargement…</div>
      ) : reqs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Vous n'avez pas encore envoyé de demande.</div>
          <button onClick={() => onTab("auguste")} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>✦ Signaler un problème à Auguste</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reqs.map(r => (
            <div key={r.ref} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: "#9ca3af" }}>Réf. {r.ref} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: r.statusColor, background: r.statusColor + "18", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{r.statusLabel}</span>
              </div>
              {r.description && <div style={{ fontSize: 13, color: "#3f3a33", lineHeight: 1.5, marginBottom: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.description}</div>}
              {/* Frise de progression */}
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {STEPS.map((s, i) => {
                  const done = r.step >= i + 1;
                  return (
                    <div key={s} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 16, height: 16, borderRadius: "50%", background: done ? r.statusColor : "#e5e7eb", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{done ? "✓" : ""}</span>
                        <span style={{ fontSize: 9.5, color: done ? r.statusColor : "#9ca3af", fontWeight: done ? 700 : 500, whiteSpace: "nowrap" }}>{s}</span>
                      </div>
                      {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: r.step >= i + 2 ? r.statusColor : "#e5e7eb", margin: "0 4px", marginBottom: 14 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Auguste() {
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, thinking]);

  async function ask(text?: string) {
    const content = (text ?? q).trim();
    if (!content || thinking) return;
    setQ("");
    const next = [...chat, { role: "user" as const, content }];
    setChat(next); setThinking(true);
    try {
      const r = await fetch("/api/client/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const d = await r.json().catch(() => ({}));
      setChat(c => [...c, { role: "assistant", content: d.reply || "Désolé, une erreur est survenue." }]);
    } catch { setChat(c => [...c, { role: "assistant", content: "Erreur réseau. Réessayez." }]); }
    finally { setThinking(false); }
  }

  return (
    <Card title="✦ Auguste — votre assistant">
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "56vh", overflowY: "auto", padding: "2px" }}>
        {chat.length === 0 && (
          <div style={{ background: "#FAF7F2", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#3f3a33", lineHeight: 1.6 }}>
            Posez-moi une question sur votre dossier :
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
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Écrivez à Auguste…" disabled={thinking} style={{ ...inp, height: 42, fontSize: 14 }} />
        <button onClick={() => ask()} disabled={thinking || !q.trim()} style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 10, border: "none", background: thinking || !q.trim() ? "#e5e7eb" : GOLD, color: "#fff", fontSize: 17, cursor: thinking || !q.trim() ? "default" : "pointer" }}>↑</button>
      </div>
    </Card>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 44, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0 14px", fontSize: 15, outline: "none", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" };
const errBox: React.CSSProperties = { color: "#dc2626", fontSize: 12.5, marginTop: 10 };
function btn(disabled: boolean): React.CSSProperties {
  return { width: "100%", marginTop: 14, height: 44, background: disabled ? "#e5e7eb" : GOLD, color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 600, cursor: disabled ? "default" : "pointer" };
}
const linkBtn: React.CSSProperties = { width: "100%", marginTop: 10, background: "none", border: "none", color: "#9ca3af", fontSize: 12.5, cursor: "pointer" };
