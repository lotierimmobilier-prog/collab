"use client";
import { useState } from "react";
import { MailThread, MailMessage, MailLabel, MailAccount } from "@/lib/mail";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
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
  sortMode?: "date" | "priority";
  onToggleSort?: () => void;
  onBulkTrash?: (ids: string[]) => void;
  onBulkLabel?: (ids: string[], labelId: string) => void;
  onBulkAssign?: (ids: string[], userId: string | null) => void;
  onBulkMarkRead?: (ids: string[], read: boolean) => void;
}

export default function ThreadList({
  threads, messages, labels, accounts, gmailConfigs = [], users = [],
  selectedId, activeLabel, activeAccount, customLabels, page, onPageChange,
  onSelect, onStar, onTrash, onApplyLabel, onAccountFilter,
  onClassifyAll, classifying, sortMode = "date", onToggleSort,
  onBulkTrash, onBulkLabel, onBulkAssign, onBulkMarkRead,
}: Props) {
  const [selectMode, setSelectMode]   = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [ctxMenu, setCtxMenu]         = useState<{ x: number; y: number; t: MailThread } | null>(null);

  function isUnreadThread(t: MailThread) { return messages.some(m => m.threadId === t.id && m.status === "unread"); }

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()); }

  const totalPages = Math.max(1, Math.ceil(threads.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = threads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagedIds   = paged.map(t => t.id);
  const allSelected = pagedIds.length > 0 && pagedIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (allSelected) setSelected(prev => { const n = new Set(prev); pagedIds.forEach(id => n.delete(id)); return n; });
    else setSelected(prev => { const n = new Set(prev); pagedIds.forEach(id => n.add(id)); return n; });
  }
  function clearSelection() { setSelected(new Set()); }
  const selIds = Array.from(selected);

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
  function getPriority(t: MailThread): "haute" | "basse" | null {
    const allLbls = messages.filter(m => m.threadId === t.id).flatMap(m => m.labels);
    if (allLbls.includes("priority:haute")) return "haute";
    if (allLbls.includes("priority:basse")) return "basse";
    return null; // normale → pas de marqueur
  }
  function accountOf(t: MailThread) { return accounts.find(a => a.id === t.accountId); }
  function formatDate(iso: string) {
    const d = new Date(iso); const now = new Date();
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

  return (
    <div style={{ width: "100%", flex: 1, minHeight: 0, borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column" }}>

      {/* ── Barre compteur / actions ── */}
      <div style={{ padding: "4px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, minHeight: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectMode && (
            <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleAll}
              style={{ width: 14, height: 14, accentColor: GOLD, cursor: "pointer", flexShrink: 0 }}
              title={allSelected ? "Tout désélectionner" : "Tout sélectionner"}
            />
          )}
          {someSelected
            ? <span style={{ fontWeight: 600, color: "#374151" }}>{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
            : <span>{threads.length} conversation{threads.length > 1 ? "s" : ""}</span>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {totalPages > 1 && !someSelected && !selectMode && <span>Page {safePage}/{totalPages}</span>}
          {!selectMode && onToggleSort && (
            <button onClick={onToggleSort}
              title={sortMode === "priority" ? "Tri par priorité actif — cliquer pour trier par date" : "Trier par priorité (urgents en haut)"}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: `1px solid ${sortMode === "priority" ? GOLD : "#e5e7eb"}`, background: sortMode === "priority" ? GOLD_BG : "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600, color: sortMode === "priority" ? GOLD : "#6b7280", whiteSpace: "nowrap" }}>
              {sortMode === "priority" ? "🔥 Priorité" : "↕ Date"}
            </button>
          )}
          {!selectMode && onClassifyAll && (
            <button onClick={onClassifyAll} disabled={classifying}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: classifying ? "#f9fafb" : "#FFFBEB", cursor: classifying ? "default" : "pointer", fontSize: 10, fontWeight: 600, color: classifying ? "#9ca3af" : GOLD, whiteSpace: "nowrap" }}>
              {classifying ? "⏳ Classification…" : "✨ Classer avec Auguste"}
            </button>
          )}
          {/* Bouton Sélectionner / Annuler */}
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${selectMode ? GOLD : "#e5e7eb"}`, background: selectMode ? GOLD_BG : "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600, color: selectMode ? GOLD : "#6b7280", whiteSpace: "nowrap" }}
          >
            {selectMode ? "✕ Annuler" : "Sélectionner"}
          </button>
        </div>
      </div>

      {/* ── Barre d'actions groupées (apparaît dès qu'une sélection) ── */}
      {someSelected && (
        <div style={{ padding: "6px 10px", borderBottom: "1px solid #e5e7eb", background: "#F7F0E6", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>

          {/* Marquer lu */}
          <BulkBtn icon="✉" label="Lu" onClick={() => { onBulkMarkRead?.(selIds, true); clearSelection(); }} />
          <BulkBtn icon="✉" label="Non lu" onClick={() => { onBulkMarkRead?.(selIds, false); clearSelection(); }} />

          {/* Libellé */}
          <div style={{ position: "relative" }}>
            <BulkBtn icon="🏷" label="Libellé" onClick={() => { setShowLabelPicker(s => !s); setShowAssignPicker(false); }} />
            {showLabelPicker && (
              <>
                <div onClick={() => setShowLabelPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 160, padding: "6px 0", marginTop: 2 }}>
                  {customLabels.map(l => (
                    <div key={l.id} onClick={() => { onBulkLabel?.(selIds, l.id); setShowLabelPicker(false); clearSelection(); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                      {l.name}
                    </div>
                  ))}
                  {customLabels.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af" }}>Aucun libellé</div>}
                </div>
              </>
            )}
          </div>

          {/* Attribuer */}
          <div style={{ position: "relative" }}>
            <BulkBtn icon="👤" label="Attribuer" onClick={() => { setShowAssignPicker(s => !s); setShowLabelPicker(false); }} />
            {showAssignPicker && (
              <>
                <div onClick={() => setShowAssignPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 160, padding: "6px 0", marginTop: 2 }}>
                  <div onClick={() => { onBulkAssign?.(selIds, null); setShowAssignPicker(false); clearSelection(); }}
                    style={{ padding: "7px 12px", cursor: "pointer", fontSize: 12, color: "#9ca3af" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >— Non assigné —</div>
                  {users.map(u => (
                    <div key={u.id} onClick={() => { onBulkAssign?.(selIds, u.id); setShowAssignPicker(false); clearSelection(); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: GOLD }}>
                        {u.prenom[0]}{u.nom[0]}
                      </div>
                      {u.prenom} {u.nom}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Supprimer */}
          <BulkBtn icon="🗑" label="Supprimer" danger onClick={() => { onBulkTrash?.(selIds); clearSelection(); }} />

          {/* Annuler sélection */}
          <button onClick={() => { clearSelection(); }} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 11, color: "#6b7280", cursor: "pointer", padding: "3px 6px", borderRadius: 5, textDecoration: "underline" }}>
            Tout désélectionner
          </button>
        </div>
      )}

      {/* ── Liste ── */}
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
          const priority   = getPriority(t);
          const msgCount  = messages.filter(m => m.threadId === t.id).length;
          const fromName  = last?.from.name || last?.from.email || "—";
          const color     = avatarColor(fromName);
          const isChecked = selected.has(t.id);

          const assignedUser = assignedId ? users.find(u => u.id === assignedId) : null;
          const assignedName = assignedUser ? `${assignedUser.prenom} ${assignedUser.nom}` : assignedId ? "—" : null;
          const repliedUser  = repliedId ? users.find(u => u.id === repliedId) : null;
          const repliedName  = repliedUser ? `${repliedUser.prenom} ${repliedUser.nom}` : repliedId ? "—" : null;

          return (
            <div key={t.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData("text/mail-thread", t.id); e.dataTransfer.effectAllowed = "move"; }}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, t }); }}
              onClick={() => selectMode ? toggleOne(t.id, { stopPropagation: () => {} } as React.MouseEvent) : onSelect(t)}
              style={{ padding: "8px 10px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: isChecked ? "#FEF9F0" : selectedId === t.id ? "#F7F0E6" : priority === "haute" ? "#FEF6F6" : "#fff", borderLeft: `3px solid ${isChecked ? GOLD : selectedId === t.id ? GOLD : priority === "haute" ? "#DC2626" : "transparent"}`, position: "relative", transition: "background 0.1s" }}
              onMouseEnter={e => !isChecked && selectedId !== t.id && (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => !isChecked && selectedId !== t.id && (e.currentTarget.style.background = "#fff")}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

                {/* Checkbox (côté gauche, visible seulement en mode sélection) */}
                {selectMode && (
                  <input type="checkbox" checked={isChecked} onChange={() => {}}
                    onClick={e => toggleOne(t.id, e)}
                    style={{ width: 14, height: 14, accentColor: GOLD, cursor: "pointer", flexShrink: 0 }} />
                )}

                {/* Avatar */}
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: isChecked ? GOLD + "30" : color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isChecked ? GOLD : "#fff", border: isChecked ? `2px solid ${GOLD}` : "none", flexShrink: 0 }}>
                  {initials(fromName)}
                </div>

                {/* Corps */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                      {unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, flexShrink: 0, display: "inline-block" }} />}
                      <span style={{ fontSize: 12, fontWeight: unread ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fromName}</span>
                      {msgCount > 1 && <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>({msgCount})</span>}
                      {acct && <div style={{ width: 5, height: 5, borderRadius: "50%", background: acct.color, flexShrink: 0 }} />}
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0, marginLeft: 4 }}>{last ? formatDate(last.date) : ""}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
                    {priority === "haute" && (
                      <span title="Priorité haute" style={{ flexShrink: 0, background: "#FEE2E2", color: "#DC2626", borderRadius: 4, padding: "0 4px", fontSize: 9, fontWeight: 700 }}>🔥 Urgent</span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: unread ? 600 : 400, color: priority === "basse" ? "#9ca3af" : unread ? "#111827" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.subject}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: tLabels.length > 0 ? 3 : 0 }}>
                    {last?.bodyText?.slice(0, 80) || ""}
                  </div>
                  {tLabels.length > 0 && (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {tLabels.map(l => (
                        <span key={l.id} style={{ background: l.color + "18", color: l.color, borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{l.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Colonne droite */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, minWidth: 52 }} onClick={e => e.stopPropagation()}>
                  {!someSelected && (
                    <div style={{ display: "flex", gap: 2 }}>
                      <button onClick={() => onStar(t.id)} title="Suivre" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: starred ? "#f59e0b" : "#e5e7eb", lineHeight: 1, padding: "1px 2px" }}>★</button>
                      <button onClick={() => onTrash(t.id)} title="Corbeille" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#e5e7eb", lineHeight: 1, padding: "1px 2px" }}>🗑</button>
                    </div>
                  )}
                  {assignedName && !repliedName && (
                    <div title={`À répondre : ${assignedName}`} style={{ display: "flex", alignItems: "center", gap: 3, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 5px" }}>
                      <span style={{ fontSize: 9, color: "#1D4ED8", fontWeight: 700 }}>→</span>
                      <span style={{ fontSize: 9, color: "#1D4ED8", fontWeight: 600, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assignedName.split(" ")[0]}</span>
                    </div>
                  )}
                  {repliedName && (
                    <div title={`Répondu par : ${repliedName}`} style={{ display: "flex", alignItems: "center", gap: 3, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "2px 5px" }}>
                      <span style={{ fontSize: 10, color: "#15803D", fontWeight: 700 }}>✓</span>
                      <span style={{ fontSize: 9, color: "#15803D", fontWeight: 600, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repliedName.split(" ")[0]}</span>
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

      {/* Menu contextuel (clic droit) */}
      {ctxMenu && (() => {
        const t = ctxMenu.t; const unread = isUnreadThread(t); const close = () => setCtxMenu(null);
        const Item = ({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) => (
          <div onClick={() => { onClick(); close(); }}
            style={{ padding: "8px 14px", fontSize: 12.5, cursor: "pointer", color: danger ? "#B91C1C" : "#374151", whiteSpace: "nowrap" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f6f3ee")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>{label}</div>
        );
        return (
          <>
            <div onClick={close} onContextMenu={e => { e.preventDefault(); close(); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
            <div style={{ position: "fixed", top: Math.min(ctxMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 240), left: Math.min(ctxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 200), zIndex: 91, background: "#fff", border: "1px solid #E6E1D9", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.16)", padding: "6px 0", minWidth: 190 }}>
              <Item label={unread ? "Marquer comme lu" : "Marquer comme non lu"} onClick={() => onBulkMarkRead?.([t.id], unread)} />
              <Item label="Marquer urgent" onClick={() => onApplyLabel(t.id, "urgents")} />
              <div style={{ height: 1, background: "#f0ece5", margin: "4px 0" }} />
              <Item label="Créer une tâche" onClick={() => onSelect(t)} />
              <Item label="Créer un rendez-vous" onClick={() => onSelect(t)} />
              <div style={{ height: 1, background: "#f0ece5", margin: "4px 0" }} />
              <Item label="Supprimer" danger onClick={() => onTrash(t.id)} />
            </div>
          </>
        );
      })()}
    </div>
  );
}

function BulkBtn({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${danger ? "#FECACA" : "#e5e7eb"}`, background: danger ? "#FEF2F2" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: danger ? "#DC2626" : "#374151", whiteSpace: "nowrap" }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? "#FEE2E2" : "#f3f4f6"; }}
      onMouseLeave={e => { e.currentTarget.style.background = danger ? "#FEF2F2" : "#fff"; }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

function PageBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ minWidth: 26, height: 26, border: active ? `1px solid ${GOLD}` : "1px solid #e5e7eb", borderRadius: 5, background: active ? GOLD : "#fff", color: active ? "#fff" : disabled ? "#d1d5db" : "#374151", fontSize: 11, cursor: disabled ? "default" : "pointer", fontWeight: active ? 600 : 400, padding: "0 5px" }}>
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
