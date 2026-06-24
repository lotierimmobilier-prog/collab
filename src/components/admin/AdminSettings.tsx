"use client";
import { useState, useEffect } from "react";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK    = "#1C1A17";
const BORDER  = "#E6E1D9";

interface Settings {
  smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string;
  smtp_from: string; notif_enabled: string;
}

export default function AdminSettings() {
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function resetData() {
    if (!confirm("⚠️ ATTENTION : Cette action supprimera TOUTES les données (tâches, calendrier, messages, baux, biens, etc.) sauf les utilisateurs.\n\nÊtes-vous absolument certain ?")) return;
    if (!confirm("Dernière confirmation : supprimer toutes les données ?")) return;
    setResetting(true);
    try {
      const r = await fetch("/api/admin/reset", { method: "POST" });
      if (r.ok) { setResetDone(true); setTimeout(() => setResetDone(false), 5000); }
    } finally { setResetting(false); }
  }

  const [settings, setSettings] = useState<Settings>({
    smtp_host: "smtp.gmail.com", smtp_port: "587",
    smtp_user: "collab@lotier-immobilier.com", smtp_pass: "",
    smtp_from: "Collab Lotier <collab@lotier-immobilier.com>",
    notif_enabled: "true",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => setSettings(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, []);

  function set(k: keyof Settings, v: string) { setSettings(p => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  async function testMail() {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch("/api/admin/settings/test-mail", { method: "POST" });
      const d = await r.json();
      setTestResult(d.ok ? "✅ Email test envoyé avec succès !" : `❌ Erreur : ${d.error}`);
    } catch { setTestResult("❌ Impossible de joindre le serveur"); }
    finally { setTesting(false); }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: DARK, marginBottom: 4 }}>Paramètres</h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Configuration des notifications email et du serveur SMTP</p>

      {/* Notifications */}
      <Section title="🔔 Notifications email">
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16 }}>
          <div
            onClick={() => set("notif_enabled", settings.notif_enabled === "true" ? "false" : "true")}
            style={{
              width: 42, height: 24, borderRadius: 12, background: settings.notif_enabled === "true" ? GOLD : "#e5e7eb",
              position: "relative", cursor: "pointer", transition: "background 0.2s",
            }}
          >
            <div style={{ position: "absolute", top: 2, left: settings.notif_enabled === "true" ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: 14, color: DARK, fontWeight: 500 }}>
            Activer les notifications email
          </span>
        </label>
        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 0 }}>
          Quand actif, des emails sont envoyés aux participants lors de la création d'événements, et aux utilisateurs assignés à une tâche.
        </p>
      </Section>

      {/* SMTP */}
      <Section title="📧 Configuration SMTP">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 12 }}>
          <Field label="Serveur SMTP (Host)">
            <input value={settings.smtp_host} onChange={e => set("smtp_host", e.target.value)} style={inp} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <input value={settings.smtp_port} onChange={e => set("smtp_port", e.target.value)} style={{ ...inp, width: 80 }} placeholder="587" />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Utilisateur / Email">
            <input value={settings.smtp_user} onChange={e => set("smtp_user", e.target.value)} style={inp} placeholder="collab@lotier-immobilier.com" />
          </Field>
          <Field label="Mot de passe / App password">
            <input type="password" value={settings.smtp_pass} onChange={e => set("smtp_pass", e.target.value)} style={inp} placeholder="••••••••••••" />
          </Field>
        </div>
        <Field label="Nom d'expéditeur (From)">
          <input value={settings.smtp_from} onChange={e => set("smtp_from", e.target.value)} style={{ ...inp, width: "100%" }} placeholder="Collab Lotier <collab@lotier-immobilier.com>" />
        </Field>

        <div style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, marginTop: 14, fontSize: 12, color: "#78726B" }}>
          <strong>Gmail :</strong> utilisez un <em>App Password</em> (Compte Google → Sécurité → Mots de passe des applications).<br />
          Le mail de notification est <strong>collab@lotier-immobilier.com</strong>.
        </div>
      </Section>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={save} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={testMail} disabled={testing} style={{ background: "#f3f4f6", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" }}>
          {testing ? "Envoi…" : "📧 Tester l'envoi"}
        </button>
        {saved && <span style={{ color: "#059669", fontSize: 13, fontWeight: 500 }}>✓ Paramètres sauvegardés</span>}
        {testResult && <span style={{ fontSize: 13 }}>{testResult}</span>}
      </div>

      <Section title="⚠️ Zone de danger">
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14, lineHeight: 1.6 }}>
          Cette action supprime <strong>toutes les données</strong> de l'application (tâches, calendrier, mails, baux, biens, messages, etc.) tout en conservant les comptes utilisateurs.
          <br />Cette opération est <strong>irréversible</strong>.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={resetData} disabled={resetting} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: resetting ? "not-allowed" : "pointer", opacity: resetting ? 0.7 : 1 }}>
            {resetting ? "Réinitialisation…" : "🗑 Réinitialiser toutes les données"}
          </button>
          {resetDone && <span style={{ color: "#059669", fontSize: 13, fontWeight: 500 }}>✓ Données supprimées — seuls les utilisateurs sont conservés</span>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px", marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: DARK, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
