"use client";
import { useState } from "react";
import { MailThread, MailMessage, MailLabel, MailAccount, buildContext } from "@/lib/mail";

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
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [aiTone, setAiTone] = useState("professionnel");
  const [aiInstruction, setAiInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showLabelMenu, setShowLabelMenu] = useState(false);

  const lastMsg = thread.messages[thread.messages.length - 1];
  const account = accounts.find(a => a.id === thread.accountId);

  const threadLabelIds = new Set(thread.messages.flatMap(m => m.labels));
  const appliedCustom = customLabels.filter(l => threadLabelIds.has(l.id));

  async function generateAIReply() {
    if (!aiKey) { setAiError("Entrez votre clé API Claude dans la barre latérale"); return; }
    setGenerating(true);
    setAiError("");
    try {
      const ctx = buildContext(thread);
      const resp = await fetch("/api/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadContext: ctx,
          subject: thread.subject,
          tone: aiTone,
          instruction: aiInstruction,
          apiKey: aiKey,
        }),
      });
      const data = await resp.json();
      if (data.error) { setAiError(data.error); return; }
      setReplyBody(data.reply ?? "");
    } catch (e) {
      setAiError("Erreur de connexion à l'API");
    } finally {
      setGenerating(false);
    }
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
      labels: ["sent", ...Array.from(threadLabelIds).filter(l => !["inbox"].includes(l))],
      inReplyTo: lastMsg.id,
    };
    onReply(msg);
    setReplyBody("");
    setShowReply(false);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.subject}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {appliedCustom.map(l => (
                <span key={l.id} style={{ background: l.color + "18", color: l.color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  {l.name}
                  <button onClick={() => onRemoveLabel(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: l.color, fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowLabelMenu(s => !s)} style={{ background: "#f3f4f6", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
                  + Libellé
                </button>
                {showLabelMenu && (
                  <>
                    <div onClick={() => setShowLabelMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                    <div style={{ position: "absolute", top: "100%", left: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 40, minWidth: 160, padding: "6px 0" }}>
                      {customLabels.map(l => (
                        <div key={l.id} onClick={() => { onApplyLabel(l.id); setShowLabelMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}
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
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onStar} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 14, color: threadLabelIds.has("starred") ? "#f59e0b" : "#9ca3af" }}>★</button>
            <button onClick={onTrash} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 14, color: "#ef4444" }}>🗑</button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {thread.messages.map((msg, i) => (
          <MessageBubble key={msg.id} msg={msg} isLast={i === thread.messages.length - 1} loadingBody={loadingBody} />
        ))}
      </div>

      {/* Reply area */}
      <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px" }}>
        {!showReply ? (
          <button onClick={() => setShowReply(true)} style={{ background: "#F7F0E6", border: "1px solid #E8D9C0", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#B8966A", fontWeight: 500 }}>
            ↩ Répondre
          </button>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {/* AI assistant */}
            <div style={{ background: "#F7F0E6", padding: "10px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#B8966A", flexShrink: 0, marginTop: 4 }}>✨ Assistant IA</span>
              <select value={aiTone} onChange={e => setAiTone(e.target.value)} style={{ height: 28, border: "1px solid #E8D9C0", borderRadius: 6, fontSize: 11, padding: "0 6px", background: "#fff", color: "#374151" }}>
                <option value="professionnel">Professionnel</option>
                <option value="cordial">Cordial</option>
                <option value="formel">Formel</option>
                <option value="concis">Concis</option>
              </select>
              <input value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} placeholder="Instruction optionnelle (ex: rappeler le loyer, refuser...)" style={{ flex: 1, minWidth: 180, height: 28, border: "1px solid #E8D9C0", borderRadius: 6, fontSize: 11, padding: "0 8px", outline: "none" }} />
              <button onClick={generateAIReply} disabled={generating} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: generating ? 0.7 : 1, display: "flex", alignItems: "center", gap: 5 }}>
                {generating ? "Génération..." : "Générer"}
              </button>
              {aiError && <div style={{ width: "100%", fontSize: 11, color: "#dc2626" }}>{aiError}</div>}
            </div>

            {/* Reply box */}
            <div style={{ padding: "8px 14px 4px", fontSize: 12, color: "#9ca3af" }}>
              À : {lastMsg.from.name} &lt;{lastMsg.from.email}&gt;
            </div>
            <textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Rédigez votre réponse ou utilisez l'assistant IA..."
              rows={6}
              style={{ width: "100%", border: "none", borderTop: "1px solid #f3f4f6", padding: "10px 14px", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <div style={{ padding: "8px 14px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={sendReply} disabled={!replyBody.trim()} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: !replyBody.trim() ? 0.5 : 1 }}>
                Envoyer
              </button>
              <button onClick={() => { setShowReply(false); setReplyBody(""); }} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "#374151" }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg, isLast, loadingBody }: { msg: MailMessage; isLast: boolean; loadingBody?: boolean }) {
  const [expanded, setExpanded] = useState(isLast);
  const date = new Date(msg.date);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setExpanded(s => !s)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: expanded ? "#fff" : "#f9fafb" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#B8966A", flexShrink: 0 }}>
          {msg.from.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{msg.from.name}</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            {expanded ? `À : ${msg.to.map(t => t.email).join(", ")}` : msg.bodyText.slice(0, 80) + (msg.bodyText.length > 80 ? "..." : "")}
          </div>
        </div>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding: "16px 16px 16px 62px", borderTop: "1px solid #f3f4f6" }}>
          {loadingBody && !msg.body ? (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #e5e7eb", borderTopColor: "#B8966A", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Chargement du message...
            </div>
          ) : (
            <div
              style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: msg.body || "<em style='color:#9ca3af'>Corps du message non disponible</em>" }}
            />
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {msg.attachments.map(att => (
                <div key={att.id} style={{ background: "#f3f4f6", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#374151", display: "flex", alignItems: "center", gap: 5 }}>
                  📎 {att.name}
                  <span style={{ color: "#9ca3af" }}>({Math.round(att.size / 1024)} Ko)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
