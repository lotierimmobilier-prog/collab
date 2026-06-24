"use client";
import { useState } from "react";
import { MailThread, MailMessage, MailLabel, MailAccount, MailAttachment, buildContext } from "@/lib/mail";

interface Props {
  thread: MailThread;
  labels: MailLabel[];
  accounts: MailAccount[];
  aiKey: string;
  loadingBody?: boolean;
  onClose: () => void;
  onReply: (m: MailMessage) => void;
  onApplyLabel: (id: string) => void;
  onRemoveLabel: (id: string) => void;
  onStar: () => void;
  onTrash: () => void;
  customLabels: MailLabel[];
}

export default function ThreadView({ thread, labels, accounts, aiKey, loadingBody, onClose, onReply, onApplyLabel, onRemoveLabel, onStar, onTrash, customLabels }: Props) {
  const [showReply, setShowReply]       = useState(false);
  const [replyBody, setReplyBody]       = useState("");
  const [aiTone, setAiTone]             = useState("professionnel");
  const [aiInstruction, setAiInstruction] = useState("");
  const [generating, setGenerating]     = useState(false);
  const [aiError, setAiError]           = useState("");
  const [showLabelMenu, setShowLabelMenu] = useState(false);

  const lastMsg = thread.messages[thread.messages.length - 1];
  const account = accounts.find(a => a.id === thread.accountId);

  const threadLabelIds = new Set(thread.messages.flatMap(m => m.labels));
  const appliedCustom  = customLabels.filter(l => threadLabelIds.has(l.id));

  async function generateAIReply() {
    if (!aiKey) { setAiError("Entrez votre clé API Claude dans la barre latérale"); return; }
    setGenerating(true); setAiError("");
    try {
      const ctx  = buildContext(thread);
      const resp = await fetch("/api/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadContext: ctx, subject: thread.subject, tone: aiTone, instruction: aiInstruction, apiKey: aiKey }),
      });
      const data = await resp.json();
      if (data.error) { setAiError(data.error); return; }
      setReplyBody(data.reply ?? "");
    } catch { setAiError("Erreur de connexion à l'API"); }
    finally { setGenerating(false); }
  }

  function sendReply() {
    if (!replyBody.trim()) return;
    const msg: MailMessage = {
      id: Date.now().toString(),
      threadId: thread.id,
      accountId: thread.accountId,
      from: { name: account?.name ?? "Moi", email: account?.email ?? "moi@agence.fr" },
      to: [{ name: lastMsg.from.name, email: lastMsg.from.email }],
      subject: `Re: ${thread.subject}`,
      body: `<p>${replyBody.replace(/\n/g, "<br/>")}</p>`,
      bodyText: replyBody,
      date: new Date().toISOString(),
      status: "read",
      labels: ["sent", ...Array.from(threadLabelIds).filter(l => l !== "inbox")],
      inReplyTo: lastMsg.id,
    };
    onReply(msg);
    setReplyBody("");
    setShowReply(false);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f9fafb", minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8, lineHeight: 1.3 }}>{thread.subject}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {appliedCustom.map(l => (
                <span key={l.id} style={{ background: l.color + "18", color: l.color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  {l.name}
                  <button onClick={() => onRemoveLabel(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: l.color, fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowLabelMenu(s => !s)} style={{ background: "#f3f4f6", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#6b7280" }}>+ Libellé</button>
                {showLabelMenu && (
                  <>
                    <div onClick={() => setShowLabelMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                    <div style={{ position: "absolute", top: "100%", left: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 40, minWidth: 160, padding: "6px 0" }}>
                      {customLabels.map(l => (
                        <div key={l.id} onClick={() => { onApplyLabel(l.id); setShowLabelMenu(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
                          {l.name}
                          {threadLabelIds.has(l.id) && <span style={{ marginLeft: "auto", color: "#059669" }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={onStar} title="Suivre" style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 14, color: threadLabelIds.has("starred") ? "#f59e0b" : "#9ca3af" }}>★</button>
            <button onClick={onTrash} title="Corbeille" style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 14, color: "#ef4444" }}>🗑</button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {thread.messages.map((msg, i) => (
          <MessageBubble key={msg.id} msg={msg} isLast={i === thread.messages.length - 1} loadingBody={loadingBody} />
        ))}
      </div>

      {/* Reply area */}
      <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px", background: "#fff" }}>
        {!showReply ? (
          <button onClick={() => setShowReply(true)} style={{ background: "#F7F0E6", border: "1px solid #E8D9C0", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#B8966A", fontWeight: 500 }}>
            ↩ Répondre
          </button>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#F7F0E6", padding: "10px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#B8966A", flexShrink: 0, marginTop: 4 }}>✨ Assistant IA</span>
              <select value={aiTone} onChange={e => setAiTone(e.target.value)} style={{ height: 28, border: "1px solid #E8D9C0", borderRadius: 6, fontSize: 11, padding: "0 6px", background: "#fff", color: "#374151" }}>
                <option value="professionnel">Professionnel</option>
                <option value="cordial">Cordial</option>
                <option value="formel">Formel</option>
                <option value="concis">Concis</option>
              </select>
              <input value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} placeholder="Instruction (ex: refuser, rappeler le loyer...)" style={{ flex: 1, minWidth: 180, height: 28, border: "1px solid #E8D9C0", borderRadius: 6, fontSize: 11, padding: "0 8px", outline: "none" }} />
              <button onClick={generateAIReply} disabled={generating} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: generating ? 0.7 : 1 }}>
                {generating ? "Génération..." : "Générer"}
              </button>
              {aiError && <div style={{ width: "100%", fontSize: 11, color: "#dc2626" }}>{aiError}</div>}
            </div>
            <div style={{ padding: "8px 14px 4px", fontSize: 12, color: "#9ca3af" }}>À : {lastMsg.from.name} &lt;{lastMsg.from.email}&gt;</div>
            <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Rédigez votre réponse ou utilisez l'assistant IA..." rows={6}
              style={{ width: "100%", border: "none", borderTop: "1px solid #f3f4f6", padding: "10px 14px", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ padding: "8px 14px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 8 }}>
              <button onClick={sendReply} disabled={!replyBody.trim()} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: !replyBody.trim() ? 0.5 : 1 }}>Envoyer</button>
              <button onClick={() => { setShowReply(false); setReplyBody(""); }} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "#374151" }}>Annuler</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mail-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #374151; }
        .mail-body img { max-width: 100%; height: auto; border-radius: 4px; }
        .mail-body a { color: #B8966A; }
        .mail-body blockquote { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #e5e7eb; color: #6b7280; background: #f9fafb; border-radius: 0 4px 4px 0; }
        .mail-body pre, .mail-body div[style*="font-family: monospace"] { white-space: pre-wrap; font-family: inherit; }
        .mail-body table { border-collapse: collapse; max-width: 100%; }
        .mail-body td, .mail-body th { padding: 4px 8px; }
      `}</style>
    </div>
  );
}

function MessageBubble({ msg, isLast, loadingBody }: { msg: MailMessage; isLast: boolean; loadingBody?: boolean }) {
  const [expanded, setExpanded] = useState(isLast);
  const date = new Date(msg.date);
  const initials = (msg.from.name || msg.from.email).charAt(0).toUpperCase();

  // Couleur avatar déterministe selon l'email
  const COLORS = ["#B8966A", "#059669", "#2563EB", "#7C3AED", "#DC2626", "#D97706"];
  const avatarColor = COLORS[msg.from.email.charCodeAt(0) % COLORS.length];

  const hasBody = msg.body && msg.body.trim().length > 0;
  const attachments: MailAttachment[] = msg.attachments ?? [];

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* En-tête message */}
      <div
        onClick={() => setExpanded(s => !s)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: expanded ? "#fff" : "#fafafa", transition: "background 0.1s" }}
        onMouseEnter={e => !expanded && (e.currentTarget.style.background = "#f3f4f6")}
        onMouseLeave={e => !expanded && (e.currentTarget.style.background = "#fafafa")}
      >
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor + "20", border: `2px solid ${avatarColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{msg.from.name || msg.from.email}</span>
              {msg.from.name && msg.from.email && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>&lt;{msg.from.email}&gt;</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {attachments.length > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>📎 {attachments.length}</span>}
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{date.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined, hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ color: "#d1d5db", fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
            </div>
          </div>
          {!expanded && (
            <div style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {msg.bodyText.replace(/\s+/g, " ").slice(0, 100) || "(Chargement...)"}
            </div>
          )}
          {expanded && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              À : {msg.to.map(t => t.name ? `${t.name} <${t.email}>` : t.email).join(", ")}
              {msg.cc && msg.cc.length > 0 && ` · Cc : ${msg.cc.map(t => t.email).join(", ")}`}
            </div>
          )}
        </div>
      </div>

      {/* Corps */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6" }}>
          {loadingBody && !hasBody ? (
            <div style={{ padding: "20px 20px 20px 64px", display: "flex", alignItems: "center", gap: 10, color: "#9ca3af", fontSize: 13 }}>
              <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #e5e7eb", borderTopColor: "#B8966A", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Chargement du message...
            </div>
          ) : !hasBody ? (
            <div style={{ padding: "20px 20px 20px 64px", color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>
              Corps du message non disponible
            </div>
          ) : (
            <div style={{ padding: "16px 20px 16px 64px" }}>
              {/* Corps HTML rendu dans un iframe sandboxé ou div selon la source */}
              <div
                className="mail-body"
                style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, overflowX: "auto" }}
                dangerouslySetInnerHTML={{ __html: msg.body }}
              />
            </div>
          )}

          {/* Pièces jointes */}
          {attachments.length > 0 && (
            <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 20px 12px 64px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {attachments.map(att => (
                <AttachmentChip key={att.id} att={att} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentChip({ att }: { att: MailAttachment }) {
  function download() {
    if (!att.data) return;
    const mime = att.mime || att.type || "application/octet-stream";
    const blob = base64ToBlob(att.data, mime);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = att.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const icon = fileIcon(att.name);
  const sizeStr = att.size > 1024 * 1024
    ? `${(att.size / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.round(att.size / 1024)} Ko`;

  return (
    <button
      onClick={att.data ? download : undefined}
      title={att.data ? `Télécharger ${att.name}` : att.name}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
        padding: "6px 12px", fontSize: 12, cursor: att.data ? "pointer" : "default",
        color: "#374151", transition: "background 0.15s",
      }}
      onMouseEnter={e => att.data && (e.currentTarget.style.background = "#F7F0E6")}
      onMouseLeave={e => att.data && (e.currentTarget.style.background = "#f9fafb")}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>{sizeStr}{att.data ? " · Télécharger" : ""}</div>
      </div>
    </button>
  );
}

function base64ToBlob(b64: string, mime: string): Blob {
  const byteStr = atob(b64);
  const arr = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "🖼";
  if (["pdf"].includes(ext)) return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜";
  if (["mp4", "avi", "mov", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "ogg"].includes(ext)) return "🎵";
  return "📎";
}
