"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MailAccount, Protocol, getPreset, ACCOUNT_COLORS, IMAP_PRESETS } from "@/lib/mail";

interface TestResult { ok: boolean; message?: string; error?: string; inbox?: { messages: number; unseen: number } }
interface UserOpt { id: string; name: string; email: string; }

export default function AccountConfigPanel({ accounts, onSave, onClose, onSyncAccount }: {
  accounts: MailAccount[];
  onSave: (a: MailAccount[]) => void;
  onClose: () => void;
  onSyncAccount?: (a: MailAccount) => void;
}) {
  const [list, setList]       = useState<MailAccount[]>(accounts);
  const [editing, setEditing] = useState<MailAccount | null>(null);
  const [showForm, setShowForm] = useState(accounts.length === 0);
  const [syncing, setSyncing]   = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});
  const [repairing, setRepairing] = useState<string | null>(null);
  const [users, setUsers]       = useState<UserOpt[]>([]);

  // Réparer le cloisonnement : ré-affecte les messages de la boîte à son agent
  // légitime (purge les fuites). Réservé au super admin (boîtes gérables).
  async function repairAccount(a: MailAccount) {
    if (!confirm(`Réparer le cloisonnement de « ${a.label} » ?\n\nLes messages de cette boîte seront ré-affectés à son agent et disparaîtront des espaces des autres utilisateurs.`)) return;
    setRepairing(a.id);
    setSyncResult(p => ({ ...p, [a.id]: "Réparation en cours…" }));
    try {
      const resp = await fetch("/api/mail/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, action: "repair" }) });
      const data = await resp.json();
      if (resp.ok && data.ok) setSyncResult(p => ({ ...p, [a.id]: `✓ Cloisonnement réparé (${data.repaired} message(s) ré-affecté(s)).` }));
      else setSyncResult(p => ({ ...p, [a.id]: `Erreur : ${data.error || "échec"}` }));
    } catch { setSyncResult(p => ({ ...p, [a.id]: "Erreur réseau" })); }
    finally { setRepairing(null); }
  }

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setUsers(d.map((u: { id: string; prenom: string; nom: string; email: string }) => ({ id: u.id, name: `${u.prenom} ${u.nom}`, email: u.email })));
    }).catch(() => {});
  }, []);

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
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 580, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Comptes email</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Configurez vos comptes IMAP / POP3 et gérez les accès</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {!showForm && !editing && (
            <>
              {list.map(a => (
                <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {a.label.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{a.label}</span>
                        {a.isShared && <span style={{ background: "#EFF6FF", color: "#2563EB", borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>Partagé</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{a.email}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{a.protocol.toUpperCase()} · {a.host}:{a.port}{a.ssl ? " · SSL" : ""}</div>
                      {a.lastSync && <div style={{ fontSize: 10, color: "#059669", marginTop: 2 }}>Dernière sync : {a.lastSync}</div>}

                      {/* Utilisateurs ayant accès */}
                      {a.isShared && (
                        <div style={{ marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>Accès : </span>
                          {a.sharedUserIds && a.sharedUserIds.length > 0 ? (
                            a.sharedUserIds.map(uid => {
                              const u = users.find(x => x.id === uid);
                              return u ? (
                                <span key={uid} style={{ display: "inline-block", background: "#F7F0E6", color: "#B8966A", borderRadius: 5, padding: "1px 7px", fontSize: 10, margin: "1px 3px 1px 0", fontWeight: 500 }}>{u.name}</span>
                              ) : null;
                            })
                          ) : (
                            <span style={{ fontSize: 11, color: "#d1d5db" }}>Aucun utilisateur ajouté</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {a.canManage === false ? (
                        <span title="Boîte partagée : gérée par le super administrateur. Vous pouvez la consulter et écrire, mais pas la modifier." style={{ fontSize: 10.5, color: "#9ca3af", display: "flex", alignItems: "center", gap: 4 }}>🔒 lecture seule</span>
                      ) : (
                        <>
                          <button onClick={() => setEditing(a)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", background: "#fff" }}>✏</button>
                          <button onClick={() => deleteAccount(a.id)} style={{ border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#dc2626", background: "#fff" }}>✕</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <TestButton account={a} />
                    <button onClick={() => syncAccount(a)} disabled={syncing === a.id}
                      style={{ flex: 1, background: syncing === a.id ? "#f3f4f6" : "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: syncing === a.id ? "default" : "pointer", color: "#059669", fontWeight: 500 }}>
                      {syncing === a.id ? "Sync…" : "🔄 Synchroniser"}
                    </button>
                    {a.canManage !== false && (
                      <button onClick={() => repairAccount(a)} disabled={repairing === a.id}
                        title="Réparer le cloisonnement : ré-affecte les messages de la boîte à son agent légitime"
                        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: repairing === a.id ? "default" : "pointer", color: "#8a6d44", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {repairing === a.id ? "…" : "🔧 Cloisonner"}
                      </button>
                    )}
                  </div>

                  {syncResult[a.id] && (
                    <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 6, fontSize: 11, background: syncResult[a.id].startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: syncResult[a.id].startsWith("✓") ? "#166534" : "#991b1b", border: `1px solid ${syncResult[a.id].startsWith("✓") ? "#bbf7d0" : "#fecaca"}` }}>
                      {syncResult[a.id]}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => setShowForm(true)} style={{ width: "100%", border: "1px dashed #e5e7eb", borderRadius: 10, padding: "12px 0", fontSize: 13, cursor: "pointer", color: "#B8966A", background: "none" }}>
                + Ajouter un compte email
              </button>
            </>
          )}

          {(showForm || editing) && (
            <>
              {!editing && (
                <AgentQuickConnect
                  users={users}
                  colorIndex={list.length}
                  onSave={a => { saveAccount(a); }}
                  onCancel={() => { setShowForm(false); setEditing(null); }}
                />
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 10 }}>
                {!editing ? "Ou configurer manuellement" : "Modifier le compte"}
              </div>
              <AccountForm
                account={editing}
                colorIndex={list.length}
                users={users}
                onSave={saveAccount}
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            </>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Fermer</button>
          <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </>
  );
}

function TestButton({ account }: { account: MailAccount }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult]   = useState<TestResult | null>(null);
  async function test() {
    setTesting(true); setResult(null);
    try {
      const resp = await fetch("/api/mail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: account.host, port: account.port, ssl: account.ssl, username: account.username, password: account.password, protocol: account.protocol }) });
      setResult(await resp.json());
    } catch { setResult({ ok: false, error: "Erreur réseau" }); }
    finally { setTesting(false); }
  }
  return (
    <div style={{ flex: 1 }}>
      <button onClick={test} disabled={testing} style={{ width: "100%", background: testing ? "#f3f4f6" : "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: testing ? "default" : "pointer", color: "#1e40af", fontWeight: 500 }}>
        {testing ? "Test…" : "🔌 Tester"}
      </button>
      {result && (
        <div style={{ marginTop: 6, padding: "7px 10px", borderRadius: 6, fontSize: 11, background: result.ok ? "#f0fdf4" : "#fef2f2", color: result.ok ? "#166534" : "#991b1b", border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}` }}>
          {result.ok ? result.message : result.error}
          {result.ok && result.inbox && <div style={{ marginTop: 3 }}>INBOX — {result.inbox.messages} messages · {result.inbox.unseen} non lus</div>}
        </div>
      )}
    </div>
  );
}

const OVH_PRESET = { host: "ssl0.ovh.net", port: "993", ssl: true, smtpHost: "ssl0.ovh.net", smtpPort: "587", smtpSsl: false };

function AgentQuickConnect({ users, colorIndex, onSave, onCancel }: { users: UserOpt[]; colorIndex: number; onSave: (a: MailAccount) => void; onCancel: () => void }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const user = users.find(u => u.id === selectedUser);
  const email = user?.email ?? "";
  const canTest = !!(email && password);

  async function testAndSave() {
    if (!canTest) return;
    setTesting(true); setTestResult(null);
    try {
      const resp = await fetch("/api/mail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: OVH_PRESET.host, port: OVH_PRESET.port, ssl: OVH_PRESET.ssl, username: email, password, protocol: "imap" }) });
      const result: TestResult = await resp.json();
      setTestResult(result);
      if (result.ok) {
        onSave({
          id: Date.now().toString(),
          label: user!.name,
          email, name: user!.name,
          protocol: "imap",
          ...OVH_PRESET,
          port: 993, smtpPort: 587,
          username: email, password,
          color: ACCOUNT_COLORS[colorIndex % ACCOUNT_COLORS.length],
          // L'agent choisi devient le seul à accéder à cette boîte (cloisonnement) ;
          // l'admin qui paramètre n'y a pas accès.
          active: true, isShared: true, sharedUserIds: [selectedUser],
        });
      }
    } catch { setTestResult({ ok: false, error: "Erreur réseau" }); }
    finally { setTesting(false); }
  }

  return (
    <div style={{ background: "#F7F0E6", border: "1px solid #E8D9C0", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#B8966A", marginBottom: 12 }}>⚡ Connexion rapide — Compte agent Lotier</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Agent</div>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ width: "100%", height: 34, border: "1px solid #E8D9C0", borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#fff", fontFamily: "inherit" }}>
            <option value="">— Choisir un agent —</option>
            {users.filter(u => u.email.endsWith("@lotier-immobilier.com")).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Mot de passe</div>
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe email" style={{ width: "100%", height: 34, border: "1px solid #E8D9C0", borderRadius: 7, padding: "0 36px 0 10px", fontSize: 12, outline: "none", background: "#fff", fontFamily: "inherit", boxSizing: "border-box" }} />
            <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9ca3af" }}>👁</button>
          </div>
        </div>
      </div>
      {email && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Serveur : ssl0.ovh.net · IMAP 993 · SMTP 587</div>}
      {testResult && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 7, fontSize: 11, background: testResult.ok ? "#f0fdf4" : "#fef2f2", color: testResult.ok ? "#166534" : "#991b1b", border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}` }}>
          {testResult.ok ? `✓ Connexion réussie — compte ajouté` : testResult.error}
          {testResult.ok && testResult.inbox && ` · INBOX : ${testResult.inbox.messages} msgs, ${testResult.inbox.unseen} non lus`}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #E8D9C0", borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#9ca3af" }}>Annuler</button>
        <button onClick={testAndSave} disabled={!canTest || testing} style={{ flex: 1, background: canTest ? "#B8966A" : "#e5e7eb", color: canTest ? "#fff" : "#9ca3af", border: "none", borderRadius: 7, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: canTest ? "pointer" : "default" }}>
          {testing ? "Test en cours…" : "Tester et ajouter"}
        </button>
      </div>
    </div>
  );
}

function AccountForm({ account, colorIndex, users, onSave, onCancel }: {
  account: MailAccount | null;
  colorIndex: number;
  users: UserOpt[];
  onSave: (a: MailAccount) => void;
  onCancel: () => void;
}) {
  const { data: session } = useSession();
  const isSuper = session?.user?.superAdmin === true;
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
    isShared: def?.isShared ?? false,
    sharedUserIds: def?.sharedUserIds ?? [] as string[],
  });
  const [showPwd, setShowPwd]     = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving]       = useState(false);

  function set(k: string, v: unknown) { setF(p => ({ ...p, [k]: v })); }

  function toggleUser(uid: string) {
    setF(p => ({
      ...p,
      sharedUserIds: p.sharedUserIds.includes(uid)
        ? p.sharedUserIds.filter(x => x !== uid)
        : [...p.sharedUserIds, uid],
    }));
  }

  function handleEmailBlur() {
    const preset = getPreset(f.email);
    if (preset) setF(p => ({ ...p, host: preset.host, port: String(preset.port), smtpHost: preset.smtpHost, smtpPort: String(preset.smtpPort), ssl: true }));
    if (!f.username) setF(p => ({ ...p, username: p.email }));
  }

  async function testConnection() {
    if (!f.host || !f.username || !f.password) return;
    setTesting(true); setTestResult(null);
    try {
      const resp = await fetch("/api/mail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: f.host, port: f.port, ssl: f.ssl, username: f.username, password: f.password, protocol: f.protocol }) });
      setTestResult(await resp.json());
    } catch { setTestResult({ ok: false, error: "Erreur réseau" }); }
    finally { setTesting(false); }
  }

  async function submit() {
    setSaving(true);
    try {
      // Sauvegarder en BDD si compte partagé
      let dbId = account?.dbId;
      if (f.isShared) {
        const method = dbId ? "PATCH" : "POST";
        const url = "/api/mail/accounts";
        const resp = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dbId, ...f, port: parseInt(f.port), smtpPort: parseInt(f.smtpPort) }),
        });
        if (resp.ok) {
          const data = await resp.json();
          dbId = data.id;
        }
      }

      onSave({
        id:    account?.id ?? Date.now().toString(),
        label: f.label || f.email,
        email: f.email,
        name:  f.name || f.email,
        protocol: f.protocol,
        host: f.host, port: parseInt(f.port), ssl: f.ssl,
        username: f.username, password: f.password,
        smtpHost: f.smtpHost, smtpPort: parseInt(f.smtpPort), smtpSsl: f.smtpSsl,
        color: f.color, active: f.active,
        isShared: f.isShared,
        sharedUserIds: f.sharedUserIds,
        dbId,
      });
    } finally { setSaving(false); }
  }

  const canTest = !!(f.host && f.username && f.password);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>{account ? "Modifier" : "Nouveau"} compte</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 6 }}>Presets rapides</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(IMAP_PRESETS).map(domain => (
            <button key={domain} onClick={() => { const p = IMAP_PRESETS[domain]; setF(prev => ({ ...prev, host: p.host, port: String(p.port), smtpHost: p.smtpHost, smtpPort: String(p.smtpPort), ssl: true })); }}
              style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Compte partagé toggle — réservé au super administrateur */}
      {isSuper && (
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: f.isShared ? "#EFF6FF" : "#f9fafb", border: `1.5px solid ${f.isShared ? "#2563EB" : "#e5e7eb"}`, borderRadius: 10, cursor: "pointer", marginBottom: 14 }}>
        <div style={{ width: 36, height: 20, borderRadius: 10, background: f.isShared ? "#2563EB" : "#d1d5db", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
          <div style={{ position: "absolute", top: 2, left: f.isShared ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
        </div>
        <input type="checkbox" checked={f.isShared} onChange={e => set("isShared", e.target.checked)} style={{ display: "none" }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: f.isShared ? "#1e40af" : "#374151" }}>Compte d'agence partagé</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Plusieurs utilisateurs peuvent accéder à ce compte</div>
        </div>
      </label>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["imap", "pop3"] as Protocol[]).map(p => (
          <label key={p} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1.5px solid ${f.protocol === p ? "#B8966A" : "#e5e7eb"}`, borderRadius: 8, cursor: "pointer", background: f.protocol === p ? "#F7F0E6" : "#fff" }}>
            <input type="radio" name="proto" checked={f.protocol === p} onChange={() => set("protocol", p)} style={{ display: "none" }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: f.protocol === p ? "#B8966A" : "#374151" }}>{p.toUpperCase()}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <F label="Libellé"><input value={f.label} onChange={e => set("label", e.target.value)} placeholder="Agence principale" style={inp} /></F>
        <F label="Nom affiché"><input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Lotier Immobilier" style={inp} /></F>
        <div style={{ gridColumn: "span 2" }}>
          <F label="Adresse email *"><input value={f.email} onChange={e => set("email", e.target.value)} onBlur={handleEmailBlur} placeholder="contact@agence.fr" style={{ ...inp, width: "100%" }} /></F>
        </div>
        <F label="Identifiant"><input value={f.username} onChange={e => set("username", e.target.value)} style={inp} /></F>
        <F label="Mot de passe">
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={f.password} onChange={e => set("password", e.target.value)} style={{ ...inp, paddingRight: 36 }} />
            <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9ca3af" }}>👁</button>
          </div>
        </F>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "12px 0 8px" }}>Serveur entrant</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 8 }}>
        <F label="Hôte"><input value={f.host} onChange={e => set("host", e.target.value)} placeholder="imap.example.com" style={inp} /></F>
        <F label="Port"><input type="number" value={f.port} onChange={e => set("port", e.target.value)} style={inp} /></F>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginBottom: 14 }}>
        <input type="checkbox" checked={f.ssl} onChange={e => set("ssl", e.target.checked)} /> SSL / TLS
      </label>

      <button onClick={testConnection} disabled={!canTest || testing}
        style={{ width: "100%", background: canTest ? "#eff6ff" : "#f9fafb", border: `1px solid ${canTest ? "#bfdbfe" : "#e5e7eb"}`, borderRadius: 8, padding: "9px 0", fontSize: 12, fontWeight: 500, cursor: canTest ? "pointer" : "default", color: canTest ? "#1e40af" : "#9ca3af", marginBottom: 8 }}>
        {testing ? "Test en cours..." : "🔌 Tester la connexion IMAP"}
      </button>
      {testResult && (
        <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12, background: testResult.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`, color: testResult.ok ? "#166534" : "#991b1b" }}>
          {testResult.ok ? testResult.message : testResult.error}
          {testResult.ok && testResult.inbox && <div style={{ marginTop: 4, fontWeight: 600 }}>INBOX : {testResult.inbox.messages} msgs · {testResult.inbox.unseen} non lus</div>}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Serveur sortant (SMTP)</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 14 }}>
        <F label="Hôte SMTP"><input value={f.smtpHost} onChange={e => set("smtpHost", e.target.value)} placeholder="smtp.example.com" style={inp} /></F>
        <F label="Port"><input type="number" value={f.smtpPort} onChange={e => set("smtpPort", e.target.value)} style={inp} /></F>
      </div>

      {/* Accès utilisateurs (si compte partagé) */}
      {f.isShared && users.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Utilisateurs autorisés</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
            {users.map(u => (
              <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "5px 4px", borderRadius: 6, background: f.sharedUserIds.includes(u.id) ? "#F7F0E6" : "transparent" }}
                onMouseEnter={e => !f.sharedUserIds.includes(u.id) && (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => !f.sharedUserIds.includes(u.id) && (e.currentTarget.style.background = "transparent")}
              >
                <input type="checkbox" checked={f.sharedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} style={{ width: 14, height: 14, accentColor: "#B8966A" }} />
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#B8966A20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#B8966A" }}>
                  {u.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{u.email}</div>
                </div>
                {f.sharedUserIds.includes(u.id) && <span style={{ marginLeft: "auto", color: "#B8966A", fontSize: 12 }}>✓</span>}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>
            {f.sharedUserIds.length === 0 ? "Aucun accès accordé" : `${f.sharedUserIds.length} utilisateur(s) autorisé(s)`}
          </div>
        </div>
      )}

      <F label="Couleur">
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {ACCOUNT_COLORS.map(c => <div key={c} onClick={() => set("color", c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: f.color === c ? "3px solid #fff" : "3px solid transparent", outline: f.color === c ? `2px solid ${c}` : "none", boxSizing: "border-box" }} />)}
        </div>
      </F>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
        <button onClick={submit} disabled={!f.email || !f.host || saving}
          style={{ background: (!f.email || !f.host) ? "#e5e7eb" : "#B8966A", color: (!f.email || !f.host) ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 }}>
          {saving ? "Enregistrement…" : account ? "Enregistrer" : "Ajouter le compte"}
        </button>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 34, border: "1px solid #e5e7eb", borderRadius: 7, padding: "0 10px", fontSize: 12, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
