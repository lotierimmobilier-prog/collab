"use client";
import { MailThread, MailMessage, MailLabel, MailAccount } from "@/lib/mail";

interface Props {
  threads: MailThread[];
  messages: MailMessage[];
  labels: MailLabel[];
  accounts: MailAccount[];
  selectedId?: string;
  activeLabel: string;
  customLabels: MailLabel[];
  onSelect: (t: MailThread) => void;
  onStar: (id: string) => void;
  onTrash: (id: string) => void;
  onApplyLabel: (threadId: string, labelId: string) => void;
}

export default function ThreadList({ threads, messages, labels, accounts, selectedId, activeLabel, customLabels, onSelect, onStar, onTrash, onApplyLabel }: Props) {
  function isUnread(t: MailThread) {
    return messages.some(m => m.threadId === t.id && m.status === "unread");
  }
  function isStarred(t: MailThread) {
    return messages.some(m => m.threadId === t.id && m.labels.includes("starred"));
  }
  function lastMsg(t: MailThread) {
    const msgs = messages.filter(m => m.threadId === t.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return msgs[0];
  }
  function threadLabels(t: MailThread) {
    const ids = new Set(messages.filter(m => m.threadId === t.id).flatMap(m => m.labels));
    return labels.filter(l => !l.system && ids.has(l.id));
  }
  function accountOf(t: MailThread) {
    return accounts.find(a => a.id === t.accountId);
  }
  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (now.getTime() - d.getTime() < 7 * 86400000) return d.toLocaleDateString("fr-FR", { weekday: "short" });
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  return (
    <div style={{ width: 320, flexShrink: 0, borderRight: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {threads.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13, flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 32 }}>📭</div>
          <div>Aucun message</div>
        </div>
      ) : threads.map((t) => {
        const last = lastMsg(t);
        const unread = isUnread(t);
        const starred = isStarred(t);
        const acct = accountOf(t);
        const tLabels = threadLabels(t);
        const msgCount = messages.filter(m => m.threadId === t.id).length;

        return (
          <div
            key={t.id}
            onClick={() => onSelect(t)}
            style={{
              padding: "12px 14px", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
              background: selectedId === t.id ? "#F7F0E6" : unread ? "#fafafa" : "#fff",
              borderLeft: selectedId === t.id ? "3px solid #B8966A" : "3px solid transparent",
              position: "relative",
            }}
            onMouseEnter={e => selectedId !== t.id && (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={e => selectedId !== t.id && (e.currentTarget.style.background = unread ? "#fafafa" : "#fff")}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              {/* Unread dot */}
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: unread ? "#B8966A" : "transparent", flexShrink: 0, marginTop: 5 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: unread ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                      {last?.from.name || last?.from.email || "—"}
                    </span>
                    {msgCount > 1 && <span style={{ fontSize: 10, color: "#9ca3af" }}>({msgCount})</span>}
                    {acct && <div style={{ width: 6, height: 6, borderRadius: "50%", background: acct.color, flexShrink: 0 }} />}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{last ? formatDate(last.date) : ""}</span>
                </div>

                <div style={{ fontSize: 13, fontWeight: unread ? 600 : 400, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                  {t.subject}
                </div>

                <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {last?.bodyText.slice(0, 80)}
                </div>

                {tLabels.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                    {tLabels.map(l => (
                      <span key={l.id} style={{ background: l.color + "18", color: l.color, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{l.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons on hover */}
            <div className="thread-actions" style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => onStar(t.id)} title="Suivre" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: starred ? 1 : 0.3, color: "#f59e0b" }}>★</button>
              <button onClick={() => onTrash(t.id)} title="Corbeille" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, opacity: 0.3, color: "#ef4444" }}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
