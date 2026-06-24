"use client";
import { MailThread, MailMessage, MailLabel, MailAccount } from "@/lib/mail";

const PAGE_SIZE = 15;

interface GmailCfg { accountId: string; email: string; name: string }

interface Props {
  threads: MailThread[];
  messages: MailMessage[];
  labels: MailLabel[];
  accounts: MailAccount[];
  gmailConfigs?: GmailCfg[];
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
}

export default function ThreadList({ threads, messages, labels, accounts, gmailConfigs = [], selectedId, activeLabel, activeAccount, customLabels, page, onPageChange, onSelect, onStar, onTrash, onApplyLabel, onAccountFilter }: Props) {
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
      {/* Filtre par compte */}
      {showAccountFilter && (
        <div style={{ padding: "5px 10px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => onAccountFilter("all")} style={{ padding: "2px 8px", borderRadius: 20, border: activeAccount === "all" ? "1.5px solid #B8966A" : "1px solid #e5e7eb", background: activeAccount === "all" ? "#F7F0E6" : "#f9fafb", fontSize: 10, fontWeight: activeAccount === "all" ? 600 : 400, color: activeAccount === "all" ? "#B8966A" : "#6b7280", cursor: "pointer" }}>Tous</button>
          {accounts.map(a => (
            <button key={a.id} onClick={() => onAccountFilter(a.id)} title={a.label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, border: activeAccount === a.id ? `1.5px solid ${a.color}` : "1px solid #e5e7eb", background: activeAccount === a.id ? a.color + "18" : "#f9fafb", fontSize: 10, fontWeight: activeAccount === a.id ? 600 : 400, color: activeAccount === a.id ? a.color : "#6b7280", cursor: "pointer", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.color, flexShrink: 0, display: "inline-block" }} />
              {a.label}
            </button>
          ))}
          {gmailConfigs.map(cfg => (
            <button key={cfg.accountId} onClick={() => onAccountFilter(cfg.accountId)} title={cfg.email} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, border: activeAccount === cfg.accountId ? "1.5px solid #EA4335" : "1px solid #e5e7eb", background: activeAccount === cfg.accountId ? "#FEF2F2" : "#f9fafb", fontSize: 10, fontWeight: activeAccount === cfg.accountId ? 600 : 400, color: activeAccount === cfg.accountId ? "#EA4335" : "#6b7280", cursor: "pointer", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <svg width="8" height="8" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {cfg.name || cfg.email.split("@")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Compteur */}
      <div style={{ padding: "4px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
        <span>{threads.length} conversation{threads.length > 1 ? "s" : ""}</span>
        {totalPages > 1 && <span>Page {safePage}/{totalPages}</span>}
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
          const assigned  = getAssignedLabel(t);
          const replied   = getRepliedLabel(t);
          const msgCount  = messages.filter(m => m.threadId === t.id).length;
          const fromName  = last?.from.name || last?.from.email || "—";
          const color     = avatarColor(fromName);

          return (
            <div key={t.id} onClick={() => onSelect(t)}
              style={{ padding: "9px 12px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: selectedId === t.id ? "#F7F0E6" : "#fff", borderLeft: `3px solid ${selectedId === t.id ? "#B8966A" : "transparent"}`, position: "relative", transition: "background 0.1s" }}
              onMouseEnter={e => selectedId !== t.id && (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => selectedId !== t.id && (e.currentTarget.style.background = "#fff")}
            >
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>

                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: 1 }}>
                  {initials(fromName)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Ligne 1 : Expéditeur + date */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#B8966A", flexShrink: 0, display: "inline-block" }} />}
                      <span style={{ fontSize: 12, fontWeight: unread ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fromName}
                      </span>
                      {msgCount > 1 && <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>({msgCount})</span>}
                      {acct && <div style={{ width: 5, height: 5, borderRadius: "50%", background: acct.color, flexShrink: 0 }} />}
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0, marginLeft: 6 }}>{last ? formatDate(last.date) : ""}</span>
                  </div>

                  {/* Ligne 2 : Sujet */}
                  <div style={{ fontSize: 12, fontWeight: unread ? 600 : 400, color: unread ? "#111827" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                    {t.subject}
                  </div>

                  {/* Ligne 3 : Aperçu */}
                  <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {last?.bodyText?.slice(0, 90) || ""}
                  </div>

                  {/* Ligne 4 : Labels + badges assignation/réponse */}
                  {(tLabels.length > 0 || assigned || replied) && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                      {tLabels.map(l => (
                        <span key={l.id} style={{ background: l.color + "18", color: l.color, borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{l.name}</span>
                      ))}
                      {assigned && (
                        <span style={{ background: "#EFF6FF", color: "#2563EB", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>→ répondre</span>
                      )}
                      {replied && (
                        <span style={{ background: "#F0FDF4", color: "#059669", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>✓ répondu</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions hover */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onStar(t.id)} title="Suivre" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: starred ? "#f59e0b" : "#d1d5db", lineHeight: 1 }}>★</button>
                  <button onClick={() => onTrash(t.id)} title="Corbeille" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#e5e7eb", lineHeight: 1 }}>🗑</button>
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
