"use client";
import { MailThread, MailMessage, MailLabel, MailAccount } from "@/lib/mail";

const PAGE_SIZE = 15;

interface GmailCfg { accountId: string; email: string; name: string }
interface SimpleUser { id: string; prenom: string; nom: string }

interface Props {
  threads: MailThread[];
  messages: MailMessage[];
  labels: MailLabel[];
  accounts: MailAccount[];
  gmailConfigs?: GmailCfg[];
  users?: SimpleUser[];
  selectedId?: string;
  activeLabel: string;
  activeAccount: string;
  customLabels: MailLabel[];
  page: number;
  onPageChange: (p: number) => void;
  onSelect: (t: MailThread) => void;
  onStar: (id: string) => void;
  onTrash: (id: string) => void;
  onApplyLabel: (threadId: string, labelId: string) => void;
  onAccountFilter: (id: string) => void;
  onClassifyAll?: () => void;
  classifying?: boolean;
}

export default function ThreadList({ threads, messages, labels, accounts, gmailConfigs = [], users = [], selectedId, activeLabel, activeAccount, customLabels, page, onPageChange, onSelect, onStar, onTrash, onApplyLabel, onAccountFilter, onClassifyAll, classifying }: Props) {
  const totalPages = Math.max(1, Math.ceil(threads.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = threads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function isUnread(t: MailThread) { return messages.some(m => m.threadId === t.id && m.status === "unread"); }
  function isStarred(t: MailThread) { return messages.some(m => m.threadId === t.id && m.labels.includes("starred")); }
  function lastMsg(t: MailThread) {
    return messages.filter(m => m.threadId === t.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }
  function threadCustomLabels(t: MailThread) {
    const ids = new Set(messages.filter(m => m.threadId === t.id).flatMap(m => m.labels));
    return customLabels.filter(l => ids.has(l.id));
  }
  function getAssignedLabel(t: MailThread): string | null {
    const allLbls = messages.filter(m => m.threadId === t.id).flatMap(m => m.labels);
    const tag = allLbls.find(l => l.startsWith("assigned:"));
    return tag ? tag.slice("assigned:".length) : null;
  }
  function getRepliedLabel(t: MailThread): string | null {
    const allLbls = messages.filter(m => m.threadId === t.id).flatMap(m => m.labels);
    const tag = allLbls.find(l => l.startsWith("replied:"));
    return tag ? tag.slice("replied:".length) : null;
  }
  function accountOf(t: MailThread) { return accounts.find(a => a.id === t.accountId); }
  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (now.getTime() - d.getTime() < 7 * 86400000) return d.toLocaleDateString("fr-FR", { weekday: "short" });
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }
  function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  const COLORS = ["#B8966A","#2563EB","#059669","#7C3AED","#DC2626","#0891B2","#D97706"];
  function avatarColor(str: string) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % COLORS.length; return COLORS[h]; }

  const showAccountFilter = accounts.length + gmailConfigs.length > 1;

  return (
    <div style={{ width: "100%", flexShrink: 0, borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Filtre compte géré par les checkboxes de la sidebar */}

      {/* Barre compteur + bouton Auguste */}
      <div style={{ padding: "4px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span>{threads.length} conversation{threads.length > 1 ? "s" : ""}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {totalPages > 1 && <span>Page {safePage}/{totalPages}</span>}
          {onClassifyAll && (
            <button onClick={onClassifyAll} disabled={classifying} title="Auguste classe et attribue les mails non traités" style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: classifying ? "#f9fafb" : "#FFFBEB", cursor: classifying ? "default" : "pointer", fontSize: 10, fontWeight: 600, color: classifying ? "#9ca3af" : "#B8966A", whiteSpace: "nowrap" }}>
              {classifying ? "⏳ Classification…" : "✨ Classer avec Auguste"}
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {paged.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13, flexDirection: "column", gap: 8, paddingTop: 40 }}>
            <div style={{ fontSize: 32 }}>📭</div>
            <div>Aucun message</div>
          </div>
        ) : paged.map(t => {
          const last      = lastMsg(t);
          const unread    = isUnread(t);
          const starred   = isStarred(t);
          const acct      = accountOf(t);
          const tLabels   = threadCustomLabels(t);
          const assignedId = getAssignedLabel(t);
          const repliedId  = getRepliedLabel(t);
          const msgCount  = messages.filter(m => m.threadId === t.id).length;
          const fromName  = last?.from.name || last?.from.email || "—";
          const color     = avatarColor(fromName);

          // Résoudre l'utilisateur assigné
          const assignedUser = assignedId ? users.find(u => u.id === assignedId) : null;
          const assignedName = assignedUser ? `${assignedUser.prenom} ${assignedUser.nom}` : assignedId ? "—" : null;
          const repliedUser  = repliedId ? users.find(u => u.id === repliedId) : null;
          const repliedName  = repliedUser ? `${repliedUser.prenom} ${repliedUser.nom}` : repliedId ? "—" : null;

          return (
            <div key={t.id} onClick={() => onSelect(t)}
              style={{ padding: "8px 10px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: selectedId === t.id ? "#F7F0E6" : "#fff", borderLeft: `3px solid ${selectedId === t.id ? "#B8966A" : "transparent"}`, position: "relative", transition: "background 0.1s" }}
              onMouseEnter={e => selectedId !== t.id && (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => selectedId !== t.id && (e.currentTarget.style.background = "#fff")}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>

                {/* Avatar */}
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: 1 }}>
                  {initials(fromName)}
                </div>

                {/* Corps */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Ligne 1 : Expéditeur + date */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                      {unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#B8966A", flexShrink: 0, display: "inline-block" }} />}
                      <span style={{ fontSize: 12, fontWeight: unread ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fromName}
                      </span>
                      {msgCount > 1 && <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>({msgCount})</span>}
                      {acct && <div style={{ width: 5, height: 5, borderRadius: "50%", background: acct.color, flexShrink: 0 }} />}
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0, marginLeft: 4 }}>{last ? formatDate(last.date) : ""}</span>
                  </div>

                  {/* Ligne 2 : Sujet */}
                  <div style={{ fontSize: 11, fontWeight: unread ? 600 : 400, color: unread ? "#111827" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>
                    {t.subject}
                  </div>

                  {/* Ligne 3 : Aperçu */}
                  <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: tLabels.length > 0 ? 3 : 0 }}>
                    {last?.bodyText?.slice(0, 80) || ""}
                  </div>

                  {/* Ligne 4 : Labels personnalisés */}
                  {tLabels.length > 0 && (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {tLabels.map(l => (
                        <span key={l.id} style={{ background: l.color + "18", color: l.color, borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{l.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Colonne droite : assignation + répondu + actions */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, minWidth: 52 }} onClick={e => e.stopPropagation()}>
                  {/* Actions hover */}
                  <div style={{ display: "flex", gap: 2 }}>
                    <button onClick={() => onStar(t.id)} title="Suivre" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: starred ? "#f59e0b" : "#e5e7eb", lineHeight: 1, padding: "1px 2px" }}>★</button>
                    <button onClick={() => onTrash(t.id)} title="Corbeille" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#e5e7eb", lineHeight: 1, padding: "1px 2px" }}>🗑</button>
                  </div>

                  {/* Badge assigné */}
                  {assignedName && !repliedName && (
                    <div title={`À répondre : ${assignedName}`} style={{ display: "flex", alignItems: "center", gap: 3, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 5px" }}>
                      <span style={{ fontSize: 9, color: "#1D4ED8", fontWeight: 700 }}>→</span>
                      <span style={{ fontSize: 9, color: "#1D4ED8", fontWeight: 600, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {assignedName.split(" ")[0]}
                      </span>
                    </div>
                  )}

                  {/* Badge répondu */}
                  {repliedName && (
                    <div title={`Répondu par : ${repliedName}`} style={{ display: "flex", alignItems: "center", gap: 3, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "2px 5px" }}>
                      <span style={{ fontSize: 10, color: "#15803D", fontWeight: 700 }}>✓</span>
                      <span style={{ fontSize: 9, color: "#15803D", fontWeight: 600, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {repliedName.split(" ")[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
          <PageBtn disabled={safePage <= 1} onClick={() => onPageChange(1)}>«</PageBtn>
          <PageBtn disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>‹</PageBtn>
          {pageNumbers(safePage, totalPages).map((p, i) =>
            p === null ? <span key={`d${i}`} style={{ padding: "0 2px", color: "#9ca3af", fontSize: 11 }}>…</span>
            : <PageBtn key={p} active={p === safePage} onClick={() => onPageChange(p)}>{p}</PageBtn>
          )}
          <PageBtn disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>›</PageBtn>
          <PageBtn disabled={safePage >= totalPages} onClick={() => onPageChange(totalPages)}>»</PageBtn>
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ minWidth: 26, height: 26, border: active ? "1px solid #B8966A" : "1px solid #e5e7eb", borderRadius: 5, background: active ? "#B8966A" : "#fff", color: active ? "#fff" : disabled ? "#d1d5db" : "#374151", fontSize: 11, cursor: disabled ? "default" : "pointer", fontWeight: active ? 600 : 400, padding: "0 5px" }}>
      {children}
    </button>
  );
}

function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | null)[] = [1];
  if (current > 3) pages.push(null);
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
}
