"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK    = "#1C1A17";
const BORDER  = "#E6E1D9";

interface Member { id: string; prenom: string; nom: string; avatar?: string | null; }
interface Channel {
  id: string; name: string; isDirect: boolean; description?: string;
  members: Member[];
  lastMessage?: { content: string; createdAt: string } | null;
  unread: number;
}
interface Attachment { name: string; size: number; mime?: string; data: string }
interface Message {
  id: string; channelId: string; content: string; createdAt: string;
  sender: Member; isMe: boolean; attachments?: Attachment[];
}

const MAX_ATTACH_BYTES = 20 * 1024 * 1024; // 20 Mo
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function InternalChat() {
  const { data: session } = useSession();
  const [channels, setChannels]           = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [pending, setPending]             = useState<Attachment[]>([]);
  const [attachErr, setAttachErr]         = useState("");
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup]   = useState(false);
  const [allUsers, setAllUsers]           = useState<Member[]>([]);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setAttachErr("");
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    const next: Attachment[] = [...pending];
    for (const f of files) {
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      next.push({ name: f.name, size: f.size, mime: f.type || undefined, data });
    }
    const total = next.reduce((s, a) => s + a.size, 0);
    if (total > MAX_ATTACH_BYTES) { setAttachErr("Pièces jointes trop volumineuses (max 20 Mo au total)."); return; }
    setPending(next);
  }

  const fetchChannels = useCallback(async () => {
    const r = await fetch("/api/internal/channels");
    if (r.ok) setChannels(await r.json());
  }, []);

  const fetchMessages = useCallback(async (channelId: string) => {
    const r = await fetch(`/api/internal/messages?channelId=${channelId}`);
    if (r.ok) {
      const msgs = await r.json();
      setMessages(msgs);
      setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unread: 0 } : c));
    }
  }, []);

  useEffect(() => {
    fetchChannels();
    fetch("/api/users").then(r => r.json()).then((users: (Member & { active: boolean })[]) =>
      setAllUsers(users.filter(u => u.active && u.id !== session?.user?.id))
    ).catch(() => {});
  }, [fetchChannels, session?.user?.id]);

  // Polling messages actifs toutes les 5s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeChannel) return;
    pollRef.current = setInterval(() => fetchMessages(activeChannel.id), 5_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChannel, fetchMessages]);

  // Scroll en bas à chaque nouveau message
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if ((!input.trim() && pending.length === 0) || !activeChannel || sending) return;
    setSending(true);
    const content = input.trim();
    const atts = pending;
    setInput(""); setPending([]); setAttachErr("");
    try {
      const r = await fetch("/api/internal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeChannel.id, content, attachments: atts }),
      });
      if (r.ok) {
        const msg = await r.json();
        setMessages(prev => [...prev, msg]);
        fetchChannels();
      } else {
        const d = await r.json().catch(() => ({}));
        const reason = d.error
          || (r.status === 413 ? "Fichier trop volumineux pour le serveur (limite réseau)."
          :  r.status === 500 ? "Erreur serveur — les pièces jointes ne sont peut-être pas encore activées en base."
          :  `Échec de l'envoi (code ${r.status}).`);
        setAttachErr(reason); setInput(content); setPending(atts);
      }
    } catch {
      setAttachErr("Échec de l'envoi (réseau)."); setInput(content); setPending(atts);
    } finally { setSending(false); }
  }

  async function openDirect(userId: string) {
    const r = await fetch("/api/internal/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDirect: true, memberIds: [userId] }),
    });
    if (r.ok) {
      await fetchChannels();
      const data = await r.json();
      setChannels(prev => {
        const ch = prev.find(c => c.id === data.id);
        if (ch) { setActiveChannel(ch); fetchMessages(ch.id); }
        return prev;
      });
    }
    setShowNewDirect(false);
  }

  function selectChannel(ch: Channel) {
    setActiveChannel(ch);
    fetchMessages(ch.id);
  }

  const initials = (m: Member) => ((m.prenom?.[0] ?? "") + (m.nom?.[0] ?? "")).toUpperCase();
  const COLORS = [GOLD, "#059669", "#2563EB", "#7C3AED", "#DC2626", "#D97706"];
  const avatarColor = (id: string) => COLORS[id.charCodeAt(0) % COLORS.length];
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const directChannels = channels.filter(c => c.isDirect);
  const groupChannels  = channels.filter(c => !c.isDirect);

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#fff" }}>
      {/* Sidebar channels */}
      <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", background: "#FAFAF8" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Messages internes</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Équipe {session?.user?.roleId ?? ""}</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Messages directs */}
          <div style={{ padding: "10px 14px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Direct</span>
            <button onClick={() => setShowNewDirect(true)} title="Nouveau message" style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 16, lineHeight: 1 }}>+</button>
          </div>
          {directChannels.map(ch => (
            <ChannelItem key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => selectChannel(ch)} initials={initials} avatarColor={avatarColor} />
          ))}
          {directChannels.length === 0 && (
            <div style={{ padding: "4px 16px 8px", fontSize: 12, color: "#9ca3af" }}>Aucune conversation</div>
          )}

          {/* Groupes */}
          <div style={{ padding: "10px 14px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Équipes & groupes</span>
            {session?.user?.roleId === "admin" && (
              <button onClick={() => setShowNewGroup(true)} title="Créer un groupe" style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 16, lineHeight: 1 }}>+</button>
            )}
          </div>
          {groupChannels.map(ch => (
            <ChannelItem key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => selectChannel(ch)} initials={initials} avatarColor={avatarColor} isGroup />
          ))}
          {groupChannels.length === 0 && (
            <div style={{ padding: "4px 16px 8px", fontSize: 12, color: "#9ca3af" }}>Aucun groupe</div>
          )}
        </div>
      </div>

      {/* Zone de chat */}
      {activeChannel ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header channel */}
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: activeChannel.isDirect ? "50%" : 10, background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: GOLD }}>
              {activeChannel.isDirect ? initials(activeChannel.members.find(m => m.id !== session?.user?.id) ?? activeChannel.members[0]) : "#"}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{activeChannel.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {activeChannel.isDirect ? "Message direct" : `${activeChannel.members.length} membres`}
                {activeChannel.description && ` · ${activeChannel.description}`}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 2 }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                Commencez la conversation !
              </div>
            )}
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showSender = !prev || prev.sender.id !== msg.sender.id || (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) > 5 * 60_000;
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.isMe ? "flex-end" : "flex-start", marginTop: showSender ? 12 : 2 }}>
                  {showSender && !msg.isMe && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: avatarColor(msg.sender.id) + "20", border: `1.5px solid ${avatarColor(msg.sender.id)}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: avatarColor(msg.sender.id) }}>
                        {initials(msg.sender)}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: DARK }}>{msg.sender.prenom} {msg.sender.nom}</span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  {msg.content && (
                    <div style={{
                      maxWidth: "70%", padding: "8px 12px", borderRadius: msg.isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: msg.isMe ? GOLD : "#f3f4f6",
                      color: msg.isMe ? "#fff" : DARK,
                      fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {msg.content}
                    </div>
                  )}
                  {(msg.attachments?.length ?? 0) > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: msg.content ? 4 : 0, maxWidth: "70%", alignItems: msg.isMe ? "flex-end" : "flex-start" }}>
                      {msg.attachments!.map((a, k) => (
                        <a key={k} href={`data:${a.mime || "application/octet-stream"};base64,${a.data}`} download={a.name}
                          title={`Télécharger ${a.name}`}
                          style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "7px 10px", maxWidth: 260 }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>📎</span>
                          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                            <span style={{ fontSize: 10, color: "#9ca3af" }}>{humanSize(a.size)}</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                  {msg.isMe && showSender && (
                    <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{formatTime(msg.createdAt)}</span>
                  )}
                </div>
              );
            })}
            <div ref={messagesEnd} />
          </div>

          {/* Saisie */}
          <div style={{ padding: "10px 20px 12px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Pièces jointes en attente */}
            {pending.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pending.map((a, k) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F7F0E6", border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "4px 8px", fontSize: 11, color: DARK }}>
                    📎 <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    <span style={{ color: "#9ca3af" }}>{humanSize(a.size)}</span>
                    <button onClick={() => setPending(p => p.filter((_, j) => j !== k))} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            {attachErr && <span style={{ fontSize: 11, color: "#dc2626" }}>{attachErr}</span>}
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={fileRef} type="file" multiple onChange={onPickFiles} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} title="Joindre des fichiers (max 20 Mo)"
                style={{ flexShrink: 0, width: 40, height: 40, border: `1px solid ${BORDER}`, borderRadius: 10, background: "#f9fafb", cursor: "pointer", fontSize: 16, color: "#6b7280" }}>📎</button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                placeholder={`Message à ${activeChannel.name}…`}
                style={{ flex: 1, height: 40, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0 14px", fontSize: 13, outline: "none", fontFamily: "inherit", background: "#f9fafb" }}
              />
              <button
                onClick={send}
                disabled={(!input.trim() && pending.length === 0) || sending}
                style={{ background: (input.trim() || pending.length) ? GOLD : "#e5e7eb", color: (input.trim() || pending.length) ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: (input.trim() || pending.length) ? "pointer" : "default", transition: "background 0.15s" }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#9ca3af", background: "#f9fafb" }}>
          <div style={{ fontSize: 48 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: DARK }}>Messagerie interne</div>
          <div style={{ fontSize: 13 }}>Sélectionnez une conversation ou démarrez-en une nouvelle</div>
          <button onClick={() => setShowNewDirect(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", marginTop: 4 }}>
            + Nouveau message
          </button>
        </div>
      )}

      {/* Modal nouveau message direct */}
      {showNewDirect && (
        <PickUserModal title="Nouveau message direct" users={allUsers} initials={initials} avatarColor={avatarColor}
          onSelect={u => openDirect(u.id)} onClose={() => setShowNewDirect(false)} />
      )}

      {/* Modal nouveau groupe (admin only) */}
      {showNewGroup && (
        <NewGroupModal users={allUsers} initials={initials} avatarColor={avatarColor}
          onClose={() => setShowNewGroup(false)}
          onCreate={async (name, desc, memberIds) => {
            const r = await fetch("/api/internal/channels", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, description: desc, isDirect: false, memberIds }),
            });
            if (r.ok) { await fetchChannels(); setShowNewGroup(false); }
          }}
        />
      )}
    </div>
  );
}

function ChannelItem({ ch, active, onClick, initials, avatarColor, isGroup }: {
  ch: Channel; active: boolean; onClick: () => void;
  initials: (m: Member) => string; avatarColor: (id: string) => string; isGroup?: boolean;
}) {
  const otherMember = !isGroup && ch.members[0];
  return (
    <div onClick={onClick} style={{
      padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
      background: active ? GOLD_BG : "transparent",
      borderLeft: active ? `2px solid ${GOLD}` : "2px solid transparent",
    }}
      onMouseEnter={e => !active && (e.currentTarget.style.background = "#f3f0eb")}
      onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ width: 34, height: 34, borderRadius: isGroup ? 10 : "50%", background: active ? GOLD_BG : "#f3f4f6", border: `1.5px solid ${active ? GOLD : "#e5e7eb"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isGroup ? 14 : 12, fontWeight: 700, color: active ? GOLD : "#6b7280", flexShrink: 0 }}>
        {isGroup ? "#" : (otherMember ? initials(otherMember as Member) : "?")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: active || ch.unread > 0 ? 600 : 400, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</div>
        {ch.lastMessage && (
          <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.lastMessage.content}</div>
        )}
      </div>
      {ch.unread > 0 && (
        <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{ch.unread}</span>
      )}
    </div>
  );
}

function PickUserModal({ title, users, initials, avatarColor, onSelect, onClose }: {
  title: string; users: Member[]; initials: (m: Member) => string; avatarColor: (id: string) => string;
  onSelect: (u: Member) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = users.filter(u => `${u.prenom} ${u.nom}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 360, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "10px 16px" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" autoFocus
            style={{ width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {filtered.map(u => (
            <div key={u.id} onClick={() => onSelect(u)} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = GOLD_BG)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(u.id) + "20", border: `1.5px solid ${avatarColor(u.id)}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: avatarColor(u.id) }}>
                {initials(u)}
              </div>
              <span style={{ fontSize: 13, color: DARK }}>{u.prenom} {u.nom}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function NewGroupModal({ users, initials, avatarColor, onCreate, onClose }: {
  users: Member[]; initials: (m: Member) => string; avatarColor: (id: string) => string;
  onCreate: (name: string, desc: string, ids: string[]) => void; onClose: () => void;
}) {
  const [name, setName]     = useState("");
  const [desc, setDesc]     = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>Nouveau groupe</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe *" autoFocus
            style={{ width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optionnel)"
            style={{ width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Membres ({selected.length} sélectionné{selected.length > 1 ? "s" : ""})</div>
          <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
            {users.map(u => (
              <div key={u.id} onClick={() => toggle(u.id)} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: selected.includes(u.id) ? GOLD_BG : "transparent" }}
                onMouseEnter={e => !selected.includes(u.id) && (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => !selected.includes(u.id) && (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(u.id) + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: avatarColor(u.id) }}>{initials(u)}</div>
                <span style={{ flex: 1, fontSize: 13, color: DARK }}>{u.prenom} {u.nom}</span>
                {selected.includes(u.id) && <span style={{ color: GOLD, fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={() => name.trim() && onCreate(name.trim(), desc, selected)} disabled={!name.trim()}
            style={{ background: name.trim() ? GOLD : "#e5e7eb", color: name.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: name.trim() ? "pointer" : "default" }}>
            Créer le groupe
          </button>
        </div>
      </div>
    </>
  );
}
