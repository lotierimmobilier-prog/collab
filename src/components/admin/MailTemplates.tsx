"use client";
import { useState, useEffect } from "react";

const GOLD = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";

interface Template {
  id: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  variables: { name: string; hint: string }[];
  customized?: boolean;
}

export default function MailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string }>({ subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/mail-templates");
    if (r.ok) { const d = await r.json(); setTemplates(d.templates || []); }
  }
  useEffect(() => { load(); }, []);

  function open(t: Template) {
    setOpenId(t.id);
    setDraft({ subject: t.subject, body: t.body });
  }

  async function save(id: string) {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/mail-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subject: draft.subject, body: draft.body }),
      });
      if (r.ok) { setSavedId(id); setTimeout(() => setSavedId(null), 3000); await load(); }
    } finally { setSaving(false); }
  }

  async function reset(id: string) {
    if (!confirm("Réinitialiser ce modèle à sa version par défaut ?")) return;
    const r = await fetch(`/api/admin/mail-templates?id=${id}`, { method: "DELETE" });
    if (r.ok) { const d = await r.json(); setDraft({ subject: d.subject, body: d.body }); await load(); }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px", marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: DARK, marginBottom: 4 }}>✉️ Mails types</div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 0, marginBottom: 16 }}>
        Modèles d'emails pré-remplis (ordre de service, assistance locataire, visio). Modifiez le texte ; les variables <code>{"{{exemple}}"}</code> sont remplacées automatiquement à l'envoi. Une ligne dont la variable est vide n'apparaît pas.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {templates.map(t => (
          <div key={t.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => (openId === t.id ? setOpenId(null) : open(t))}
              style={{ width: "100%", textAlign: "left", background: openId === t.id ? GOLD_BG : "#fff", border: "none", padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>
                  {t.label}{t.customized && <span style={{ marginLeft: 8, fontSize: 10.5, color: GOLD, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "1px 6px" }}>personnalisé</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{t.description}</div>
              </div>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>{openId === t.id ? "▲" : "▼"}</span>
            </button>

            {openId === t.id && (
              <div style={{ padding: 14, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={lbl}>Objet</div>
                  <input value={draft.subject} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} style={inp} />
                </div>
                <div>
                  <div style={lbl}>Corps du message</div>
                  <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={14}
                    style={{ ...inp, height: "auto", padding: "10px", resize: "vertical", lineHeight: 1.5, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }} />
                </div>

                <div style={{ background: "#FBFAF8", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Variables disponibles (cliquez pour insérer)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {t.variables.map(v => (
                      <button key={v.name} title={v.hint}
                        onClick={() => setDraft(d => ({ ...d, body: d.body + `{{${v.name}}}` }))}
                        style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 6, padding: "3px 7px", fontSize: 11, cursor: "pointer", color: DARK, fontFamily: "ui-monospace, monospace" }}>
                        {`{{${v.name}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => save(t.id)} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button onClick={() => reset(t.id)} style={{ background: "none", color: "#6b7280", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
                    Réinitialiser
                  </button>
                  {savedId === t.id && <span style={{ color: "#059669", fontSize: 13, fontWeight: 500 }}>✓ Modèle enregistré</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };
const inp: React.CSSProperties = { width: "100%", height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
