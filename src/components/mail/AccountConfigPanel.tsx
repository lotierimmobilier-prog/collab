"use client";
import { useState } from "react";
import { MailAccount, Protocol, getPreset, ACCOUNT_COLORS, IMAP_PRESETS } from "@/lib/mail";

interface TestResult { ok: boolean; message?: string; error?: string; inbox?: { messages: number; unseen: number } }

export default function AccountConfigPanel({ accounts, onSave, onClose, onSyncAccount }: {
  accounts: MailAccount[];
  onSave: (a: MailAccount[]) => void;
  onClose: () => void;
  onSyncAccount?: (a: MailAccount) => void;
}) {
  const [list, setList] = useState<MailAccount[]>(accounts);
  const [editing, setEditing] = useState<MailAccount | null>(null);
  const [showForm, setShowForm] = useState(accounts.length === 0);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});

  function saveAccount(a: MailAccount) {
    const updated = list.find(x => x.id === a.id)
      ? list.map(x => x.id === a.id ? a : x)
      : [...list, a];
    setList(updated);
    setEditing(null);
    setShowForm(false);
  }

  function deleteAccount(id: string) { setList(p => p.filter(a => a.id !== id)); }

  async function syncAccount(a: MailAccount) {
    setSyncing(a.id);
    setSyncResult(p => ({ ...p, [a.id]: "Synchronisation en cours..." }));
    try {
      const resp = await fetch("/api/mail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: a.host, port: a.port, ssl: a.ssl, username: a.username, password: a.password, accountId: a.id, limit: 50 }),
      });
      const data = await resp.json();
      if (data.ok) {
        setSyncResult(p => ({ ...p, [a.id]: `✓ ${data.message}` }));
        if (onSyncAccount) onSyncAccount({ ...a, lastSync: new Date().toLocaleString("fr-FR") });
        setList(prev => prev.map(x => x.id === a.id ? { ...x, lastSync: new Date().toLocaleString("fr-FR") } : x));
      } else {
        setSyncResult(p => ({ ...p, [a.id]: `Erreur : ${data.error}` }));
      }
    } catch {
      setSyncResult(p => ({ ...p, [a.id]: "Erreur réseau" }));
    } finally {
      setSyncing(null);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 540, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Comptes email</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Configurez vos comptes IMAP ou POP3</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {!showForm && !editing && (
            <>
              {list.map(a => (
                <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {a.label.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{a.email}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{a.protocol.toUpperCase()} · {a.host}:{a.port}{a.ssl ? " · SSL" : ""}</div>
                      {a.lastSync && <div style={{ fontSize: 10, color: "#059669", marginTop: 2 }}>Dernière sync : {a.lastSync}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => setEditing(a)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", background: "#fff" }}>✏ Modifier</button>
                        <button onClick={() => deleteAccount(a.id)} style={{ border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#dc2626", background: "#fff" }}>Supprimer</button>
                      </div>
                    </div>
                  </div>

                  {/* Test + Sync buttons */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <TestButton account={a} />
                    <button
                      onClick={() => syncAccount(a)}
                      disabled={syncing === a.id}
                      style={{ flex: 1, background: syncing === a.id ? "#f3f4f6" : "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: syncing === a.id ? "default" : "pointer", color: "#059669", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      {syncing === a.id ? "Synchronisation..." : "🔄 Synchroniser INBOX"}
                    </button>
                  </div>

                  {syncResult[a.id] && (
                    <div style={{
                      marginTop: 8, padding: "7px 10px", borderRadius: 6, fontSize: 11,
                      background: syncResult[a.id].startsWith("✓") ? "#f0fdf4" : "#fef2f2",
                      color: syncResult[a.id].startsWith("✓") ? "#166534" : "#991b1b",
                      border: `1px solid ${syncResult[a.id].startsWith("✓") ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                      {syncResult[a.id]}
                    </div>
                  )}
                </div>
              ))}

              <button onClick={() => setShowForm(true)} style={{ width: "100%", border: "1px dashed #e5e7eb", borderRadius: 10, padding: "12px 0", fontSize: 13, cursor: "pointer", color: "#7c3aed", background: "none" }}>
                + Ajouter un compte
              </button>
            </>
          )}

          {(showForm || editing) && (
            <AccountForm
              account={editing}
              colorIndex={list.length}
              onSave={saveAccount}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Fermer</button>
          <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </>
  );
}

function TestButton({ account }: { account: MailAccount }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const resp = await fetch("/api/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: account.host, port: account.port, ssl: account.ssl,
          username: account.username, password: account.password,
          protocol: account.protocol,
        }),
      });
      const data = await resp.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Erreur réseau" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <button
        onClick={test}
        disabled={testing}
        style={{ width: "100%", background: testing ? "#f3f4f6" : "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: testing ? "default" : "pointer", color: "#1e40af", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {testing ? "Test en cours..." : "🔌 Tester la connexion"}
      </button>
      {result && (
        <div style={{
          marginTop: 6, padding: "7px 10px", borderRadius: 6, fontSize: 11,
          background: result.ok ? "#f0fdf4" : "#fef2f2",
          color: result.ok ? "#166534" : "#991b1b",
          border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}`,
        }}>
          {result.ok ? result.message : result.error}
          {result.ok && result.inbox && (
            <div style={{ marginTop: 3, color: "#059669" }}>
              INBOX — {result.inbox.messages} messages · {result.inbox.unseen} non lus
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccountForm({ account, colorIndex, onSave, onCancel }: {
  account: MailAccount | null;
  colorIndex: number;
  onSave: (a: MailAccount) => void;
  onCancel: () => void;
}) {
  const def = account;
  const [f, setF] = useState({
    label: def?.label ?? "",
    email: def?.email ?? "",
    name: def?.name ?? "",
    protocol: def?.protocol ?? "imap" as Protocol,
    host: def?.host ?? "",
    port: String(def?.port ?? 993),
    ssl: def?.ssl ?? true,
    username: def?.username ?? "",
    password: def?.password ?? "",
    smtpHost: def?.smtpHost ?? "",
    smtpPort: String(def?.smtpPort ?? 587),
    smtpSsl: def?.smtpSsl ?? true,
    color: def?.color ?? ACCOUNT_COLORS[colorIndex % ACCOUNT_COLORS.length],
    active: def?.active ?? true,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  function handleEmailBlur() {
    const preset = getPreset(f.email);
    if (preset) {
      setF(p => ({ ...p, host: preset.host, port: String(preset.port), smtpHost: preset.smtpHost, smtpPort: String(preset.smtpPort), username: p.email, ssl: true, smtpSsl: true }));
    }
    if (!f.username) setF(p => ({ ...p, username: p.email }));
  }

  async function testConnection() {
    if (!f.host || !f.username || !f.password) return;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch("/api/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: f.host, port: f.port, ssl: f.ssl, username: f.username, password: f.password, protocol: f.protocol }),
      });
      setTestResult(await resp.json());
    } catch {
      setTestResult({ ok: false, error: "Erreur réseau" });
    } finally {
      setTesting(false);
    }
  }

  function submit() {
    onSave({
      id: account?.id ?? Date.now().toString(),
      label: f.label || f.email,
      email: f.email, name: f.name || f.email,
      protocol: f.protocol,
      host: f.host, port: parseInt(f.port), ssl: f.ssl,
      username: f.username, password: f.password,
      smtpHost: f.smtpHost, smtpPort: parseInt(f.smtpPort), smtpSsl: f.smtpSsl,
      color: f.color, active: f.active,
    });
  }

  const canTest = !!(f.host && f.username && f.password);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>{account ? "Modifier" : "Nouveau"} compte</div>

      {/* Presets */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 6 }}>Presets rapides</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(IMAP_PRESETS).map(domain => (
            <button key={domain} onClick={() => { const p = IMAP_PRESETS[domain]; setF(prev => ({ ...prev, host: p.host, port: String(p.port), smtpHost: p.smtpHost, smtpPort: String(p.smtpPort), ssl: true })); }} style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "#374151" }}>
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Protocol */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["imap", "pop3"] as Protocol[]).map(p => (
          <label key={p} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1.5px solid ${f.protocol === p ? "#7c3aed" : "#e5e7eb"}`, borderRadius: 8, cursor: "pointer", background: f.protocol === p ? "#f5f3ff" : "#fff" }}>
            <input type="radio" name="proto" checked={f.protocol === p} onChange={() => set("protocol", p)} style={{ display: "none" }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: f.protocol === p ? "#7c3aed" : "#374151" }}>{p.toUpperCase()}</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{p === "imap" ? "Synchronisé" : "Téléchargement"}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <F label="Libellé"><input value={f.label} onChange={e => set("label", e.target.value)} placeholder="Agence principale" style={inp} /></F>
        <F label="Nom affiché"><input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Jean Dupont" style={inp} /></F>
        <div style={{ gridColumn: "span 2" }}>
          <F label="Adresse email *"><input value={f.email} onChange={e => set("email", e.target.value)} onBlur={handleEmailBlur} placeholder="jean@agence.fr" style={{ ...inp, width: "100%" }} /></F>
        </div>
        <F label="Identifiant (login)"><input value={f.username} onChange={e => set("username", e.target.value)} style={inp} /></F>
        <F label="Mot de passe">
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={f.password} onChange={e => set("password", e.target.value)} style={{ ...inp, paddingRight: 36 }} />
            <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9ca3af" }}>👁</button>
          </div>
        </F>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "12px 0 8px" }}>Serveur entrant ({f.protocol.toUpperCase()})</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 8 }}>
        <F label="Hôte"><input value={f.host} onChange={e => set("host", e.target.value)} placeholder="imap.example.com" style={inp} /></F>
        <F label="Port"><input type="number" value={f.port} onChange={e => set("port", e.target.value)} style={inp} /></F>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginBottom: 14 }}>
        <input type="checkbox" checked={f.ssl} onChange={e => set("ssl", e.target.checked)} /> SSL / TLS
      </label>

      {/* Test connection button */}
      <button
        onClick={testConnection}
        disabled={!canTest || testing}
        style={{ width: "100%", background: canTest ? "#eff6ff" : "#f9fafb", border: `1px solid ${canTest ? "#bfdbfe" : "#e5e7eb"}`, borderRadius: 8, padding: "9px 0", fontSize: 12, fontWeight: 500, cursor: canTest ? "pointer" : "default", color: canTest ? "#1e40af" : "#9ca3af", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {testing ? "Test en cours..." : "🔌 Tester la connexion IMAP"}
      </button>

      {testResult && (
        <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12, background: testResult.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`, color: testResult.ok ? "#166534" : "#991b1b" }}>
          {testResult.ok ? testResult.message : testResult.error}
          {testResult.ok && testResult.inbox && (
            <div style={{ marginTop: 4, fontWeight: 600 }}>
              INBOX : {testResult.inbox.messages} messages · {testResult.inbox.unseen} non lus
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Serveur sortant (SMTP)</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 14 }}>
        <F label="Hôte SMTP"><input value={f.smtpHost} onChange={e => set("smtpHost", e.target.value)} placeholder="smtp.example.com" style={inp} /></F>
        <F label="Port"><input type="number" value={f.smtpPort} onChange={e => set("smtpPort", e.target.value)} style={inp} /></F>
      </div>

      <F label="Couleur du compte">
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {ACCOUNT_COLORS.map(c => <div key={c} onClick={() => set("color", c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: f.color === c ? "3px solid #fff" : "3px solid transparent", outline: f.color === c ? `2px solid ${c}` : "none", boxSizing: "border-box" }} />)}
        </div>
      </F>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
        <button onClick={submit} disabled={!f.email || !f.host} style={{ background: (!f.email || !f.host) ? "#e5e7eb" : "#7c3aed", color: (!f.email || !f.host) ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 }}>
          {account ? "Enregistrer les modifications" : "Ajouter le compte"}
        </button>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 34, border: "1px solid #e5e7eb", borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
