"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MailAccount, MailMessage, MailThread, MailLabel,
  DEFAULT_LABELS, threadFromMessages,
} from "@/lib/mail";
import {
  loadGmailConfigs, loadGmailToken, isGmailTokenValid,
  fetchGmailMessages, saveGmailToken,
  requestGmailToken, GmailConfig,
} from "@/lib/googleGmail";
import AccountConfigPanel from "./AccountConfigPanel";
import LabelManager from "./LabelManager";
import ThreadList from "./ThreadList";
import ThreadView from "./ThreadView";
import GoogleMailConnect from "./GoogleMailConnect";

const ACCOUNTS_KEY  = "collab_mail_accounts";
const LABELS_KEY    = "collab_mail_labels";
const AI_KEY_STORE  = "collab_ai_key";
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function MailBoard() {
  const [accounts, setAccounts]           = useState<MailAccount[]>([]);
  const [gmailConfigs, setGmailConfigs]   = useState<GmailConfig[]>([]);
  const [labels, setLabels]               = useState<MailLabel[]>(DEFAULT_LABELS);
  const [messages, setMessages]           = useState<MailMessage[]>([]);
  const [threads, setThreads]             = useState<MailThread[]>([]);
  const [activeLabel, setActiveLabel]     = useState("inbox");
  const [activeAccount, setActiveAccount] = useState<string>("all");
  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null);

  // Recherche
  const [search, setSearch]               = useState("");
  const [searchInput, setSearchInput]     = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MailMessage[] | null>(null); // null = pas de recherche active
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI
  const [showImapConfig, setShowImapConfig]     = useState(false);
  const [showGmailConnect, setShowGmailConnect] = useState(false);
  const [showLabels, setShowLabels]             = useState(false);
  const [showCompose, setShowCompose]           = useState(false);
  const [aiKey, setAiKey]                       = useState("");
  const [syncing, setSyncing]                   = useState<string | null>(null);
  const [syncStatus, setSyncStatus]             = useState("");
  const [loadingBody, setLoadingBody]           = useState(false);
  const [users, setUsers]                       = useState<{ id: string; prenom: string; nom: string }[]>([]);
  const [nextSyncIn, setNextSyncIn]             = useState(SYNC_INTERVAL / 1000);

  // Pagination
  const [listPage, setListPage] = useState(1);

  // Ref pour accéder aux comptes dans le timer sans stale closure
  const accountsRef    = useRef<MailAccount[]>([]);
  const gmailConfigRef = useRef<GmailConfig[]>([]);
  accountsRef.current    = accounts;
  gmailConfigRef.current = gmailConfigs;

  useEffect(() => {
    // Charger les comptes depuis la BDD (persistance serveur)
    fetch("/api/mail/accounts")
      .then(r => r.json())
      .then((dbAccounts: Record<string, unknown>[]) => {
        if (Array.isArray(dbAccounts) && dbAccounts.length > 0) {
          const mapped: MailAccount[] = dbAccounts.map(a => ({
            id:       String(a.id),
            dbId:     String(a.id),
            label:    String(a.label),
            email:    String(a.email),
            name:     String(a.name ?? a.email),
            protocol: (a.protocol as "imap"|"pop3") ?? "imap",
            host:     String(a.host),
            port:     Number(a.port) || 993,
            ssl:      Boolean(a.ssl ?? true),
            username: String(a.username ?? a.email),
            password: "",  // masqué — les routes server récupèrent depuis DB via accountId
            smtpHost: String(a.smtpHost ?? ""),
            smtpPort: Number(a.smtpPort) || 587,
            smtpSsl:  Boolean(a.smtpSsl ?? true),
            color:    String(a.color ?? "#B8966A"),
            active:   Boolean(a.active ?? true),
            isShared: Boolean(a.isShared ?? false),
            sharedUserIds: (a.sharedUserIds as string[]) ?? [],
          }));
          setAccounts(mapped);
        } else {
          // Fallback localStorage (migration)
          const a = localStorage.getItem(ACCOUNTS_KEY);
          if (a) setAccounts(JSON.parse(a));
        }
      })
      .catch(() => {
        const a = localStorage.getItem(ACCOUNTS_KEY);
        if (a) setAccounts(JSON.parse(a));
      });

    const l = localStorage.getItem(LABELS_KEY);
    if (l) setLabels(JSON.parse(l));
    const k = localStorage.getItem(AI_KEY_STORE);
    if (k) setAiKey(k);
    fetch("/api/users").then(r => r.json()).then((us: { id: string; prenom: string; nom: string; active: boolean }[]) => setUsers(us.filter(u => u.active))).catch(() => {});
    setGmailConfigs(loadGmailConfigs());

    // Charger les emails persistés en BDD au démarrage
    fetch("/api/mail/messages?limit=500")
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.messages?.length) {
          const msgs = d.messages.map((m: Record<string, unknown>) => ({
            id:        `${m.accountId}-${m.uid}`,
            uid:       m.uid,
            threadId:  m.threadId || `${m.accountId}-${m.uid}`,
            accountId: m.accountId,
            from:      { name: m.fromName || m.fromEmail, email: m.fromEmail },
            to:        String(m.toEmail || "").split(",").map((e: string) => ({ name: e.trim(), email: e.trim() })),
            subject:   m.subject,
            body:      m.bodyHtml || "",
            bodyText:  m.bodyText || "",
            date:      m.date,
            status:    m.read ? "read" : "unread",
            labels:    m.labels || ["inbox"],
            senderType: m.senderType,
            attachments: m.attachments || [],
          }));
          ingestMessages(msgs);
        }
      })
      .catch(() => {/* silencieux */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAccounts(a: MailAccount[]) {
    setAccounts(a);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)); // garde le fallback local
  }

  async function addAccountToDb(acc: MailAccount): Promise<MailAccount> {
    try {
      const r = await fetch("/api/mail/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: acc.label, email: acc.email, name: acc.name,
          protocol: acc.protocol, host: acc.host, port: acc.port, ssl: acc.ssl,
          username: acc.username, password: acc.password,
          smtpHost: acc.smtpHost, smtpPort: acc.smtpPort, smtpSsl: acc.smtpSsl,
          color: acc.color, isShared: acc.isShared ?? false, sharedUserIds: acc.sharedUserIds ?? [],
        }),
      });
      if (r.ok) {
        const saved = await r.json();
        return { ...acc, id: saved.id, dbId: saved.id, password: "" };
      }
    } catch { /* silencieux */ }
    return acc;
  }

  async function removeAccountFromDb(acc: MailAccount) {
    const id = acc.dbId ?? acc.id;
    if (!id || id.startsWith("local-")) return;
    try {
      await fetch("/api/mail/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch { /* silencieux */ }
  }
  function saveLabels(l: MailLabel[])     { setLabels(l);   localStorage.setItem(LABELS_KEY,    JSON.stringify(l)); }
  function saveAiKey(k: string)           { setAiKey(k);    localStorage.setItem(AI_KEY_STORE,  k); }

  function ingestMessages(newMsgs: MailMessage[]) {
    setMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const fresh    = newMsgs.filter(m => !existing.has(m.id));
      const updated  = [...fresh, ...prev];
      rebuildThreads(updated);
      return updated;
    });
  }

  function addMessage(msg: MailMessage) {
    setMessages(prev => { const u = [msg, ...prev]; rebuildThreads(u); return u; });
  }

  function rebuildThreads(msgs: MailMessage[]) {
    const map = new Map<string, MailMessage[]>();
    for (const m of msgs) {
      if (!map.has(m.threadId)) map.set(m.threadId, []);
      map.get(m.threadId)!.push(m);
    }
    setThreads([...map.values()].map(threadFromMessages)
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()));
  }

  /* ── Gmail sync ─────────────────────────────────────────── */
  const syncGmail = useCallback(async (accountId: string, accessToken?: string) => {
    setSyncing(accountId);
    const cfg = loadGmailConfigs().find(c => c.accountId === accountId);
    setSyncStatus(`Synchronisation Gmail ${cfg?.email ?? ""}...`);
    try {
      let token = accessToken;
      if (!token) {
        const stored = loadGmailToken(accountId);
        if (stored && isGmailTokenValid(stored)) {
          token = stored.access_token;
        } else if (cfg) {
          const newTok = await requestGmailToken(cfg.clientId);
          saveGmailToken(accountId, newTok);
          token = newTok.access_token;
        }
      }
      if (!token) throw new Error("Token introuvable — reconnectez le compte");
      const msgs = await fetchGmailMessages(token, accountId, 50);
      ingestMessages(msgs as MailMessage[]);
      setSyncStatus(`${msgs.length} message(s) synchronisé(s) depuis Gmail`);
      setTimeout(() => setSyncStatus(""), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      setSyncStatus(`Erreur Gmail : ${msg}`);
      setTimeout(() => setSyncStatus(""), 6000);
    } finally {
      setSyncing(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── IMAP sync (page optionnelle) — retourne totalPages ─── */
  const syncImap = useCallback(async (a: MailAccount, page = 1): Promise<number> => {
    setSyncing(a.id);
    setSyncStatus(page > 1 ? `Chargement page ${page}…` : `Synchronisation ${a.label}…`);
    try {
      const resp = await fetch("/api/mail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: a.host, port: a.port, ssl: a.ssl, username: a.username, password: a.password, accountId: a.dbId ?? a.id, page, pageSize: 25 }),
      });
      const data = await resp.json();
      if (data.ok) {
        ingestMessages(data.messages ?? []);
        setSyncStatus(`${data.count} message(s) — page ${page}/${data.totalPages}`);
        saveAccounts(accountsRef.current.map(x => x.id === a.id ? { ...x, lastSync: new Date().toLocaleString("fr-FR") } : x));
        if (page >= (data.totalPages ?? 1)) setTimeout(() => setSyncStatus(""), 4000);
        return data.totalPages ?? 1;
      } else {
        setSyncStatus(`Erreur : ${data.error}`);
        setTimeout(() => setSyncStatus(""), 6000);
        return 1;
      }
    } catch {
      setSyncStatus("Erreur réseau");
      setTimeout(() => setSyncStatus(""), 4000);
      return 1;
    } finally { setSyncing(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Télécharger TOUS les mails (toutes pages) ──────────── */
  const downloadAllImap = useCallback(async (a: MailAccount) => {
    const totalPages = await syncImap(a, 1);
    for (let p = 2; p <= totalPages; p++) {
      setSyncStatus(`Téléchargement complet ${a.label} — page ${p}/${totalPages}…`);
      await syncImap(a, p);
    }
    setSyncStatus(`✓ Téléchargement complet : ${totalPages} page(s) chargée(s)`);
    setTimeout(() => setSyncStatus(""), 5000);
  }, [syncImap]);

  /* ── Sync toutes les 5 minutes ──────────────────────────── */
  useEffect(() => {
    const timer = setInterval(async () => {
      setNextSyncIn(SYNC_INTERVAL / 1000);
      for (const cfg of gmailConfigRef.current) await syncGmail(cfg.accountId);
      for (const a of accountsRef.current.filter(x => x.active)) await syncImap(a, 1);
    }, SYNC_INTERVAL);

    // Countdown
    const countdown = setInterval(() => setNextSyncIn(n => Math.max(0, n - 1)), 1000);

    return () => { clearInterval(timer); clearInterval(countdown); };
  }, [syncGmail, syncImap]);

  /* ── Recherche IMAP ─────────────────────────────────────── */
  async function runImapSearch(query: string) {
    if (!query.trim()) { setSearchResults(null); setSearch(""); return; }
    setSearch(query);
    setSearchLoading(true);

    // Recherche locale d'abord (instantanée)
    const q = query.toLowerCase();
    const localHits = messages.filter(m =>
      m.subject.toLowerCase().includes(q) ||
      m.bodyText.toLowerCase().includes(q) ||
      m.from.email.toLowerCase().includes(q) ||
      m.from.name.toLowerCase().includes(q)
    );

    // Recherche IMAP côté serveur sur chaque compte
    const imapResults: MailMessage[] = [...localHits];
    for (const a of accounts.filter(x => x.active)) {
      try {
        const resp = await fetch("/api/mail/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: a.host, port: a.port, ssl: a.ssl, username: a.username, password: a.password, accountId: a.id, query }),
        });
        const data = await resp.json();
        if (data.ok && data.messages) {
          // Ajouter uniquement les messages pas déjà chargés localement
          const existing = new Set(imapResults.map(m => m.id));
          for (const msg of data.messages) {
            if (!existing.has(msg.id)) { imapResults.push(msg); existing.add(msg.id); }
          }
        }
      } catch { /* silencieux */ }
    }

    setSearchResults(imapResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setSearchLoading(false);
  }

  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults(null); setSearch(""); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => runImapSearch(val), 600);
  }

  function clearSearch() { setSearchInput(""); setSearch(""); setSearchResults(null); setSearchLoading(false); setListPage(1); }

  /* ── Chargement du corps à la demande — TOUS les messages sans corps ── */
  async function loadMessageBody(thread: MailThread) {
    const msgsToLoad = thread.messages.filter(m => !m.body || m.body.trim() === "");
    if (!msgsToLoad.length) return;

    setLoadingBody(true);
    try {
      for (const msg of msgsToLoad) {
        const account = accounts.find(a => a.id === msg.accountId);
        if (!account) continue;
        const uid = (msg as MailMessage & { uid?: number | string }).uid;
        if (!uid) continue;

        const resp = await fetch("/api/mail/body", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: account.host, port: account.port, ssl: account.ssl, username: account.username, password: account.password, uid, accountId: account.dbId ?? account.id }),
        });
        const data = await resp.json();
        if (data.ok) {
          const patch = { body: data.bodyHtml || data.bodyText || "", bodyText: data.bodyText, attachments: data.attachments ?? [] };
          setMessages(prev => {
            const updated = prev.map(m => m.id === msg.id ? { ...m, ...patch } : m);
            rebuildThreads(updated);
            return updated;
          });
          setSelectedThread(prev => prev ? {
            ...prev,
            messages: prev.messages.map(m => m.id === msg.id ? { ...m, ...patch } : m),
          } : null);
        }
      }
    } catch { /* silencieux */ }
    finally { setLoadingBody(false); }
  }

  async function syncAll() {
    for (const cfg of gmailConfigs) await syncGmail(cfg.accountId);
    for (const a of accounts.filter(x => x.active)) await syncImap(a, 1);
    setNextSyncIn(SYNC_INTERVAL / 1000);
  }

  /* ── Label / thread ops ─────────────────────────────────── */
  function applyLabel(threadId: string, labelId: string) {
    setMessages(prev => { const u = prev.map(m => m.threadId === threadId && !m.labels.includes(labelId) ? { ...m, labels: [...m.labels, labelId] } : m); rebuildThreads(u); return u; });
    fetch("/api/mail/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, addLabels: [labelId] }) }).catch(() => {});
  }
  function removeLabel(threadId: string, labelId: string) {
    setMessages(prev => { const u = prev.map(m => m.threadId === threadId ? { ...m, labels: m.labels.filter(l => l !== labelId) } : m); rebuildThreads(u); return u; });
    fetch("/api/mail/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, removeLabels: [labelId] }) }).catch(() => {});
  }
  function setThreadLabels(threadId: string, newLabels: string[]) {
    setMessages(prev => { const u = prev.map(m => m.threadId === threadId ? { ...m, labels: newLabels } : m); rebuildThreads(u); return u; });
    setSelectedThread(prev => prev?.id === threadId ? { ...prev, messages: prev.messages.map(m => ({ ...m, labels: newLabels })) } : prev);
    fetch("/api/mail/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, setLabels: newLabels }) }).catch(() => {});
  }
  function toggleStar(threadId: string) {
    const starred = messages.some(m => m.threadId === threadId && m.labels.includes("starred"));
    starred ? removeLabel(threadId, "starred") : applyLabel(threadId, "starred");
  }
  function trash(threadId: string) { applyLabel(threadId, "trash"); if (selectedThread?.id === threadId) setSelectedThread(null); }
  function markRead(threadId: string) {
    setMessages(prev => { const u = prev.map(m => m.threadId === threadId ? { ...m, status: "read" as const } : m); rebuildThreads(u); return u; });
  }

  /* ── Threads visibles ───────────────────────────────────── */
  const visibleThreads = (() => {
    // Recherche active : on utilise les résultats IMAP
    if (search && searchResults !== null) {
      const resultIds = new Set(searchResults.map(m => m.id));
      // Reconstruire les threads à partir des résultats
      const map = new Map<string, MailMessage[]>();
      for (const m of searchResults) {
        if (!map.has(m.threadId)) map.set(m.threadId, []);
        map.get(m.threadId)!.push(m);
      }
      return [...map.values()].map(threadFromMessages)
        .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
      void resultIds;
    }

    return threads.filter(t => {
      const allMsgs = messages.filter(m => m.threadId === t.id);
      if (activeAccount !== "all" && t.accountId !== activeAccount) return false;
      if (activeLabel === "inbox") return allMsgs.some(m => m.labels.includes("inbox") && !m.labels.includes("trash"));
      if (activeLabel === "trash") return allMsgs.some(m => m.labels.includes("trash"));
      return allMsgs.some(m => m.labels.includes(activeLabel));
    });
  })();

  const unread     = (labelId: string) => threads.filter(t => messages.some(m => m.threadId === t.id && m.labels.includes(labelId) && m.status === "unread")).length;
  const customLabels  = labels.filter(l => !l.system);
  const systemLabels  = labels.filter(l => l.system);
  const totalUnread   = messages.filter(m => m.status === "unread" && m.labels.includes("inbox") && !m.labels.includes("trash")).length;
  const hasAnyAccount = accounts.length > 0 || gmailConfigs.length > 0;

  const fmtCountdown = (s: number) => s < 60 ? `${s}s` : `${Math.ceil(s / 60)}min`;

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width: 224, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => setShowCompose(true)} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ✏ Nouveau message
          </button>
        </div>

        {/* Barre de recherche */}
        <div style={{ padding: "0 12px 10px", position: "relative" }}>
          <span style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 13, pointerEvents: "none" }}>
            {searchLoading ? "⏳" : "🔍"}
          </span>
          <input
            value={searchInput}
            onChange={e => { handleSearchInput(e.target.value); setListPage(1); }}
            onKeyDown={e => e.key === "Enter" && runImapSearch(searchInput)}
            placeholder="Rechercher dans les mails..."
            style={{ width: "100%", paddingLeft: 30, paddingRight: searchInput ? 26 : 8, height: 32, border: `1px solid ${searchInput ? "#B8966A" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}
          />
          {searchInput && (
            <button onClick={clearSearch} style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: 0 }}>×</button>
          )}
        </div>

        {/* Labels */}
        <NavLabel>Boîte</NavLabel>
        {systemLabels.map(l => (
          <NavItem key={l.id} active={activeLabel === l.id} onClick={() => { setActiveLabel(l.id); setSelectedThread(null); clearSearch(); setListPage(1); }}>
            <span style={{ fontSize: 14 }}>{labelIcon(l.id)}</span>
            <span style={{ flex: 1 }}>{l.name}</span>
            {unread(l.id) > 0 && <Badge>{unread(l.id)}</Badge>}
          </NavItem>
        ))}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 4px" }}>
          <NavLabel inline>Libellés</NavLabel>
          <button onClick={() => setShowLabels(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>+</button>
        </div>
        {customLabels.map(l => (
          <NavItem key={l.id} active={activeLabel === l.id} onClick={() => { setActiveLabel(l.id); setSelectedThread(null); clearSearch(); setListPage(1); }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12 }}>{l.name}</span>
          </NavItem>
        ))}

        {/* Gmail accounts */}
        {gmailConfigs.length > 0 && (
          <>
            <NavLabel>Gmail</NavLabel>
            <NavItem active={activeAccount === "all"} onClick={() => setActiveAccount("all")}>
              <span style={{ fontSize: 14 }}>📧</span>
              <span style={{ flex: 1, fontSize: 12 }}>Tous les comptes</span>
              {totalUnread > 0 && <Badge>{totalUnread}</Badge>}
            </NavItem>
            {gmailConfigs.map(cfg => {
              const tok   = loadGmailToken(cfg.accountId);
              const valid = isGmailTokenValid(tok);
              return (
                <NavItem key={cfg.accountId} active={activeAccount === cfg.accountId} onClick={() => setActiveAccount(cfg.accountId)}>
                  <GIcon />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.email.split("@")[0]}</div>
                    <div style={{ fontSize: 10, color: valid ? "#059669" : "#f59e0b" }}>{valid ? "Connecté" : "Token expiré"}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); syncGmail(cfg.accountId); }} disabled={syncing === cfg.accountId} title="Synchroniser" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af" }}>🔄</button>
                </NavItem>
              );
            })}
          </>
        )}

        {/* IMAP accounts */}
        {accounts.length > 0 && (
          <>
            <NavLabel>IMAP / POP3</NavLabel>
            {accounts.filter(a => a.active).map(a => (
              <NavItem key={a.id} active={activeAccount === a.id} onClick={() => setActiveAccount(a.id)}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); syncImap(a, 1); }} disabled={syncing === a.id} title="Sync récents" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af" }}>🔄</button>
                <button onClick={e => { e.stopPropagation(); downloadAllImap(a); }} disabled={syncing === a.id} title="Tout télécharger" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9ca3af" }}>⬇</button>
              </NavItem>
            ))}
          </>
        )}

        {/* Boutons comptes + sync */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <button onClick={() => setShowGmailConnect(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 0", fontSize: 12, cursor: "pointer", color: "#374151", fontWeight: 500, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <GIcon /> Ajouter Gmail
          </button>
          <button onClick={() => setShowImapConfig(true)} style={{ width: "100%", background: "none", border: "1px dashed #e5e7eb", borderRadius: 8, padding: "7px 0", fontSize: 12, cursor: "pointer", color: "#9ca3af" }}>
            + IMAP / POP3
          </button>
          {hasAnyAccount && (
            <button onClick={syncAll} disabled={!!syncing} style={{ width: "100%", background: "none", border: "1px solid #E8D9C0", borderRadius: 8, padding: "7px 0", fontSize: 12, cursor: "pointer", color: "#B8966A" }}>
              🔄 Synchroniser (récents)
            </button>
          )}
          {accounts.length > 0 && (
            <button onClick={() => { for (const a of accounts.filter(x => x.active)) downloadAllImap(a); }} disabled={!!syncing} style={{ width: "100%", background: "none", border: "1px dashed #B8966A", borderRadius: 8, padding: "7px 0", fontSize: 12, cursor: "pointer", color: "#B8966A" }}>
              ⬇ Tout télécharger (6 derniers mois)
            </button>
          )}
          {hasAnyAccount && !syncing && (
            <div style={{ fontSize: 10, color: "#d1d5db", textAlign: "center" }}>
              Prochaine synchro : {fmtCountdown(nextSyncIn)}
            </div>
          )}
          {syncing && (
            <div style={{ fontSize: 10, color: "#B8966A", textAlign: "center" }}>🔄 Sync en cours…</div>
          )}
        </div>

        {/* AI key */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid #f3f4f6", marginTop: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Assistant IA (Claude)</div>
          <input type="password" value={aiKey} onChange={e => saveAiKey(e.target.value)} placeholder="sk-ant-..." style={{ width: "100%", height: 30, border: "1px solid #e5e7eb", borderRadius: 6, padding: "0 8px", fontSize: 11, outline: "none", background: "#f9fafb", boxSizing: "border-box" }} />
          {aiKey && <div style={{ fontSize: 10, color: "#059669", marginTop: 3 }}>IA activée</div>}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Bandeau statut sync / recherche */}
        {(syncStatus || (search && searchResults !== null)) && (
          <div style={{ background: syncing ? "#eff6ff" : syncStatus.startsWith("Erreur") ? "#fef2f2" : search ? "#F7F0E6" : "#f0fdf4", borderBottom: "1px solid #e5e7eb", padding: "7px 16px", fontSize: 12, color: syncing ? "#1e40af" : syncStatus.startsWith("Erreur") ? "#991b1b" : search ? "#92400e" : "#166534", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              {syncing && "🔄 "}{syncStatus}
              {search && searchResults !== null && !syncStatus && (
                <>🔍 <strong>{searchResults.length}</strong> résultat(s) pour &quot;{search}&quot;</>
              )}
            </span>
            {search && <button onClick={clearSearch} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#92400e", textDecoration: "underline" }}>Effacer la recherche</button>}
          </div>
        )}

        {/* Layout vertical : liste en haut, vue en bas */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Zone liste — hauteur fixe, 10 items */}
          <div style={{ flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderBottom: "2px solid #e5e7eb" }}>
            <ThreadList
              threads={visibleThreads}
              messages={search && searchResults !== null ? [...messages, ...searchResults.filter(r => !messages.find(m => m.id === r.id))] : messages}
              labels={labels}
              accounts={accounts}
              selectedId={selectedThread?.id}
              activeLabel={activeLabel}
              activeAccount={activeAccount}
              customLabels={customLabels}
              page={listPage}
              onPageChange={p => { setListPage(p); setSelectedThread(null); }}
              onSelect={t => { setSelectedThread(t); markRead(t.id); loadMessageBody(t); }}
              onStar={toggleStar}
              onTrash={trash}
              onApplyLabel={applyLabel}
              onAccountFilter={id => { setActiveAccount(id); setSelectedThread(null); setListPage(1); }}
            />
          </div>

          {/* Zone liste uniquement — ThreadView en popup */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
            {!hasAnyAccount && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb", gap: 12 }}>
                <div style={{ fontSize: 48, opacity: 0.3 }}>✉</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#6b7280" }}>
                  {!hasAnyAccount ? "Commencez par ajouter un compte" : "Sélectionnez un message pour le lire"}
                </div>
                {!hasAnyAccount && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowGmailConnect(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <GIcon /> Connecter Gmail
                    </button>
                    <button onClick={() => setShowImapConfig(true)} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
                      Configurer IMAP
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompose && <ComposeModal accounts={accounts} gmailConfigs={gmailConfigs} labels={customLabels} onClose={() => setShowCompose(false)} onSend={msg => { addMessage(msg); setShowCompose(false); }} />}
      {showImapConfig && <AccountConfigPanel accounts={accounts} onSave={async (newList) => {
        // Détecter les comptes ajoutés (pas de dbId)
        const updatedList: MailAccount[] = [];
        for (const acc of newList) {
          if (!acc.dbId && acc.password) {
            const saved = await addAccountToDb(acc);
            updatedList.push(saved);
          } else {
            updatedList.push(acc);
          }
        }
        // Détecter les comptes supprimés
        for (const old of accounts) {
          if (!newList.find(a => a.id === old.id)) {
            await removeAccountFromDb(old);
          }
        }
        await saveAccounts(updatedList);
      }} onClose={() => setShowImapConfig(false)} />}
      {showGmailConnect && (
        <GoogleMailConnect
          onSynced={(accountId, token) => {
            setGmailConfigs(loadGmailConfigs());
            syncGmail(accountId, token);
            setShowGmailConnect(false);
          }}
          onClose={() => setShowGmailConnect(false)}
        />
      )}
      {showLabels && <LabelManager labels={labels} onSave={saveLabels} onClose={() => setShowLabels(false)} />}

      {/* Thread popup — par-dessus tout */}
      {selectedThread && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px" }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedThread(null); }}
        >
          <div style={{ width: "min(900px, 96vw)", height: "calc(100vh - 48px)", maxHeight: 860, background: "#fff", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <ThreadView
              thread={selectedThread}
              labels={labels}
              accounts={accounts}
              aiKey={aiKey}
              loadingBody={loadingBody}
              users={users}
              onClose={() => setSelectedThread(null)}
              onReply={msg => { addMessage(msg); setSelectedThread(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null); }}
              onApplyLabel={id => applyLabel(selectedThread.id, id)}
              onRemoveLabel={id => removeLabel(selectedThread.id, id)}
              onStar={() => toggleStar(selectedThread.id)}
              onTrash={() => trash(selectedThread.id)}
              customLabels={customLabels}
              onSetLabels={(lbls) => setThreadLabels(selectedThread.id, lbls)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NavLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  if (inline) return <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</span>;
  return <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 16px 4px" }}>{children}</div>;
}
function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13, color: active ? "#B8966A" : "#374151", background: active ? "#F7F0E6" : "transparent", borderLeft: active ? "2px solid #B8966A" : "2px solid transparent", fontWeight: active ? 500 : 400 }}
      onMouseEnter={e => !active && (e.currentTarget.style.background = "#f9fafb")}
      onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
    >{children}</div>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ background: "#B8966A", color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10 }}>{children}</span>;
}
function labelIcon(id: string) { return { inbox: "📥", sent: "📤", drafts: "📝", starred: "⭐", trash: "🗑" }[id] ?? "📧"; }
function GIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function ComposeModal({ accounts, gmailConfigs, labels, onClose, onSend, replyTo }: {
  accounts: MailAccount[]; gmailConfigs: GmailConfig[];
  labels: MailLabel[]; onClose: () => void; onSend: (m: MailMessage) => void;
  replyTo?: { to: string; subject: string; inReplyTo?: string; accountId?: string };
}) {
  const allAccounts = [
    ...gmailConfigs.map(c => ({ id: c.accountId, dbId: undefined as string|undefined, label: `${c.email}`, email: c.email, name: c.name ?? c.email, smtpHost: "", smtpPort: 587, smtpSsl: true, username: c.email, password: "", signature: "", color: "#4285f4" })),
    ...accounts.map(a => ({ id: a.id, dbId: a.dbId, label: `${a.label} — ${a.email}`, email: a.email, name: a.name, smtpHost: a.smtpHost, smtpPort: a.smtpPort, smtpSsl: a.smtpSsl, username: a.username, password: a.password, signature: a.signature ?? "", color: a.color })),
  ];

  const firstId = replyTo?.accountId ?? allAccounts[0]?.id ?? "";
  const [accountId, setAccountId] = useState(firstId);
  const [to, setTo]               = useState(replyTo?.to ?? "");
  const [cc, setCc]               = useState("");
  const [subject, setSubject]     = useState(replyTo?.subject ?? "");
  const [body, setBody]           = useState("");
  const [showCc, setShowCc]       = useState(false);
  const [showSig, setShowSig]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState("");
  const [selLabels, setSelLabels] = useState(["sent"]);

  const acct = allAccounts.find(a => a.id === accountId);
  const sig   = acct?.signature ?? "";

  // Charger/sauvegarder la signature depuis localStorage par compte
  const SIG_KEY = `collab_mail_sig_${accountId}`;
  const [editSig, setEditSig] = useState(() => {
    if (typeof window === "undefined") return sig;
    return localStorage.getItem(SIG_KEY) ?? sig;
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SIG_KEY);
      setEditSig(stored ?? (acct?.signature ?? ""));
    }
  }, [accountId, SIG_KEY, acct?.signature]);

  function saveSig() {
    if (typeof window !== "undefined") localStorage.setItem(SIG_KEY, editSig);
    setShowSig(false);
  }

  async function send() {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    setError("");

    const storedSig = typeof window !== "undefined" ? (localStorage.getItem(SIG_KEY) ?? "") : "";
    const fullBody  = body + (storedSig ? `\n\n--\n${storedSig}` : "");
    const fullHtml  = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${body.replace(/\n/g,"<br/>")}</div>` +
                      (storedSig ? `<br/><hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/><div style="font-family:sans-serif;font-size:12px;color:#6b7280">${storedSig.replace(/\n/g,"<br/>")}</div>` : "");

    try {
      const r = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          body: fullBody,
          html: fullHtml,
          fromEmail: acct?.email,
          fromName: acct?.name,
          accountId: acct?.dbId ?? acct?.id,
          smtpHost: acct?.smtpHost,
          smtpPort: acct?.smtpPort,
          smtpSsl: acct?.smtpSsl,
          username: acct?.username,
          password: acct?.password,
          inReplyTo: replyTo?.inReplyTo,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Erreur lors de l'envoi"); return; }

      // Ajouter le mail envoyé en local
      onSend({
        id: data.messageId ?? Date.now().toString(),
        threadId: Date.now().toString(),
        accountId: accountId || "local",
        from: { name: acct?.name ?? "", email: acct?.email ?? "" },
        to: to.split(",").map(e => ({ name: e.trim(), email: e.trim() })),
        subject: subject.trim(),
        body: fullHtml,
        bodyText: fullBody,
        date: new Date().toISOString(),
        status: "read",
        labels: selLabels,
      });
    } catch {
      setError("Erreur réseau — vérifiez votre connexion");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", bottom: 24, right: 24, width: 580, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "85vh", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#1f2937", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>✉ Nouveau message</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowSig(s => !s)} title="Gérer la signature" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#d1d5db", fontSize: 11 }}>✍ Signature</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Gestion signature */}
        {showSig && (
          <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>SIGNATURE — {acct?.email}</div>
            <textarea
              value={editSig}
              onChange={e => setEditSig(e.target.value)}
              rows={4}
              placeholder={"Cordialement,\nVotre Nom\nLotier Immobilier · 01 23 45 67 89"}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={saveSig} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>Sauvegarder</button>
              <button onClick={() => setShowSig(false)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>Annuler</button>
            </div>
          </div>
        )}

        {/* Champs */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
          {/* Expéditeur */}
          <div style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#9ca3af", width: 24, flexShrink: 0 }}>De</span>
            {allAccounts.length > 1 ? (
              <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ flex: 1, border: "none", fontSize: 12, outline: "none", color: "#374151", background: "transparent", cursor: "pointer" }}>
                {allAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: 12, color: "#374151" }}>{acct?.name} &lt;{acct?.email}&gt;</span>
            )}
            {acct && <span style={{ width: 8, height: 8, borderRadius: "50%", background: acct.color, flexShrink: 0, display: "inline-block" }} />}
          </div>

          <div style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#9ca3af", width: 24, flexShrink: 0 }}>À</span>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="destinataire@email.com" style={{ flex: 1, border: "none", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => setShowCc(s => !s)} style={{ background: "none", border: "none", fontSize: 10, color: "#9ca3af", cursor: "pointer" }}>Cc</button>
          </div>

          {showCc && (
            <div style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#9ca3af", width: 24, flexShrink: 0 }}>Cc</span>
              <input value={cc} onChange={e => setCc(e.target.value)} placeholder="copie@email.com" style={{ flex: 1, border: "none", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
          )}

          <div style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#9ca3af", width: 24, flexShrink: 0 }}>Obj</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du message" style={{ flex: 1, border: "none", fontSize: 13, outline: "none", fontFamily: "inherit", fontWeight: 500 }} />
          </div>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Rédigez votre message…"
            rows={8}
            style={{ width: "100%", border: "none", padding: "12px 0", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />

          {/* Aperçu signature */}
          {(() => { const s = typeof window !== "undefined" ? (localStorage.getItem(SIG_KEY) ?? "") : ""; return s ? (
            <div style={{ borderTop: "1px solid #f3f4f6", padding: "8px 0", fontSize: 12, color: "#9ca3af", whiteSpace: "pre-line" }}>— {s}</div>
          ) : null; })()}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {labels.map(l => (
              <button key={l.id} onClick={() => setSelLabels(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id])}
                style={{ border: `1px solid ${selLabels.includes(l.id) ? l.color : "#e5e7eb"}`, background: selLabels.includes(l.id) ? l.color + "18" : "transparent", color: selLabels.includes(l.id) ? l.color : "#9ca3af", borderRadius: 5, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>
                {l.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {error && <span style={{ fontSize: 11, color: "#dc2626", maxWidth: 200 }}>{error}</span>}
            <button onClick={send} disabled={!to.trim() || !subject.trim() || sending}
              style={{ background: !to.trim() || !subject.trim() ? "#e5e7eb" : "#B8966A", color: !to.trim() || !subject.trim() ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {sending ? "Envoi…" : "↑ Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
