"use client";
import { useState, useEffect } from "react";
import { MailThread, MailMessage, MailLabel, MailAccount, MailAttachment, buildContext } from "@/lib/mail";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const BORDER  = "#E8D9C0";

interface Props {
  thread: MailThread;
  labels: MailLabel[];
  accounts: MailAccount[];
  aiKey: string;
  loadingBody?: boolean;
  users?: { id: string; prenom: string; nom: string; email?: string }[];
  onClose: () => void;
  onReply: (m: MailMessage) => void;
  onForward?: (data: { to: string; cc?: string; subject: string; body: string; accountId: string }) => void;
  onApplyLabel: (id: string) => void;
  onRemoveLabel: (id: string) => void;
  onStar: () => void;
  onTrash: () => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
  customLabels: MailLabel[];
  onSetLabels?: (labels: string[]) => void;
}

interface AiSummary    { summary: string; points: string[] }
interface AiTask       { title: string; description: string; priority: string; assigneeId?: string; assigneeName?: string; dueDate?: string; confidence: number }
interface AiRdv        { found: boolean; title: string; start?: string; end?: string; location?: string; type?: string; attendeeId?: string; attendeeName?: string; confidence: number }
interface SenderInfo   { senderType: string; name?: string; role?: string }
interface FullAnalysis { name: string; totalEmails: number; totalInDb: number; firstContact: string; lastContact: string; summary: string; topics: string[]; actions: string[]; sentiment: string; priority: string; notes: string }
interface LegalAdvice  { question: string; answer: string; articles: string[]; warnings: string[]; suggestion: string }
interface Research     { summary: string; webSources: string[]; mailInsights: string[]; keyPoints: string[]; suggestion: string }

const SENDER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  user:    { label: "Collègue",      color: "#2563EB", bg: "#EFF6FF" },
  owner:   { label: "Propriétaire",  color: "#7C3AED", bg: "#F5F3FF" },
  tenant:  { label: "Locataire",     color: "#059669", bg: "#ECFDF5" },
  unknown: { label: "Inconnu",       color: "#6B7280", bg: "#F9FAFB" },
};

export default function ThreadView({ thread, labels, accounts, aiKey, loadingBody, users = [], onClose, onReply, onForward, onApplyLabel, onRemoveLabel, onStar, onTrash, onRestore, onDeletePermanent, customLabels, onSetLabels }: Props) {
  const [showReply, setShowReply]         = useState(false);
  const [replySize, setReplySize]         = useState<"normal" | "large" | "full">("normal");
  const [replyBody, setReplyBody]         = useState("");
  const [aiTone, setAiTone]               = useState("professionnel");
  const [aiLength, setAiLength]           = useState("moyen");
  const [aiInstruction, setAiInstruction] = useState("");
  const [generating, setGenerating]       = useState(false);
  const [aiError, setAiError]             = useState("");
  const [showLabelMenu, setShowLabelMenu] = useState(false);

  // Classification automatique
  const [classifying, setClassifying]       = useState(false);
  const [classifySuggestion, setClassifySuggestion] = useState<{ labels: string[]; assignedToId: string | null; priority: string; reason: string; hasMemory?: boolean; fromMemory?: boolean } | null>(null);
  const [memorySaving, setMemorySaving]     = useState(false);
  const [memoryMsg, setMemoryMsg]           = useState("");

  // Panneau IA
  const [aiLoading, setAiLoading]           = useState<string | null>(null);
  const [aiSummary, setAiSummary]           = useState<AiSummary | null>(null);
  const [fullAnalysis, setFullAnalysis]     = useState<FullAnalysis | null>(null);
  const [senderInfo, setSenderInfo]         = useState<SenderInfo | null>(null);
  const [taskModal, setTaskModal]           = useState<AiTask | null>(null);
  const [rdvModal, setRdvModal]             = useState<AiRdv | null>(null);
  const [taskSaving, setTaskSaving]         = useState(false);
  const [rdvSaving, setRdvSaving]           = useState(false);
  const [actionResult, setActionResult]     = useState<{ ok: boolean; msg: string } | null>(null);

  // Annuaire — détection d'expéditeur inconnu
  const [contactLookup, setContactLookup]   = useState<{ found: boolean; type?: string; name?: string } | null>(null);
  const [contactType, setContactType]       = useState("fournisseur");
  const [savingContact, setSavingContact]   = useState(false);
  const [savedContact, setSavedContact]     = useState<string | null>(null);

  // Conseil juridique
  const [showLegal, setShowLegal]           = useState(false);
  const [legalQuestion, setLegalQuestion]   = useState("");
  const [legalResult, setLegalResult]       = useState<LegalAdvice | null>(null);
  const [legalLoading, setLegalLoading]     = useState(false);
  const [legalError, setLegalError]         = useState("");

  // Recherche web + historique
  const [showResearch, setShowResearch]     = useState(false);
  const [researchQuery, setResearchQuery]   = useState("");
  const [researchResult, setResearchResult] = useState<Research | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError]   = useState("");

  const lastMsg   = thread.messages[thread.messages.length - 1];
  const firstMsg  = thread.messages[0];
  const account   = accounts.find(a => a.id === thread.accountId);

  // Vérifie si l'expéditeur existe déjà dans l'annuaire (sinon : proposer de l'ajouter)
  const senderEmail = (firstMsg?.from?.email || lastMsg?.from?.email || "").toLowerCase();
  useEffect(() => {
    if (!senderEmail) { setContactLookup(null); return; }
    setContactLookup(null); setSavedContact(null);
    fetch(`/api/contacts/lookup?email=${encodeURIComponent(senderEmail)}`)
      .then(r => r.json())
      .then(d => { setContactLookup(d); if (d?.type) setContactType(d.type); })
      .catch(() => {});
  }, [senderEmail]);

  async function saveContact() {
    const from = firstMsg?.from || lastMsg?.from;
    if (!from?.email || savingContact) return;
    setSavingContact(true);
    try {
      // Découpe un éventuel "Prénom Nom" présent dans le nom d'affichage
      const parts = (from.name || "").trim().split(/\s+/);
      const prenom = parts.length > 1 ? parts.slice(0, -1).join(" ") : (from.name || "");
      const nom = parts.length > 1 ? parts[parts.length - 1] : "";
      const r = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: contactType, prenom, nom, email: from.email }),
      });
      const d = await r.json();
      if (d.contact) {
        setSavedContact(from.name || from.email);
        setContactLookup({ found: true, type: contactType, name: from.name || from.email });
      }
    } catch { /* silencieux */ }
    finally { setSavingContact(false); }
  }
  const threadLabelIds = new Set(thread.messages.flatMap(m => m.labels));
  const appliedCustom  = customLabels.filter(l => threadLabelIds.has(l.id));

  // Labels spéciaux : assignation et réponse
  const allLabels    = Array.from(threadLabelIds);
  const assignedTag  = allLabels.find(l => l.startsWith("assigned:"));
  const repliedTag   = allLabels.find(l => l.startsWith("replied:"));
  const assignedId   = assignedTag?.slice("assigned:".length) ?? null;
  const repliedById  = repliedTag?.slice("replied:".length) ?? null;
  const assignedUser = users.find(u => u.id === assignedId);
  const repliedByUser = users.find(u => u.id === repliedById);
  const isReplied    = !!repliedTag;

  function setAssigned(userId: string | null) {
    // Retire l'ancien tag assignation, ajoute le nouveau
    const base = allLabels.filter(l => !l.startsWith("assigned:"));
    const next = userId ? [...base, `assigned:${userId}`] : base;
    onSetLabels?.(next);
  }

  function setReplied(userId: string | null) {
    const base = allLabels.filter(l => !l.startsWith("replied:"));
    const next = userId ? [...base, `replied:${userId}`] : base;
    onSetLabels?.(next);
  }

  // Classification automatique à l'ouverture si pas encore de libellés custom
  useEffect(() => {
    const hasCustomLabels = customLabels.some(l => threadLabelIds.has(l.id));
    if (hasCustomLabels || classifySuggestion || classifying) return;
    const msg = firstMsg || lastMsg;
    if (!msg) return;
    setClassifying(true);
    fetch("/api/mail/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: thread.subject,
        bodyText: msg.bodyText || "",
        fromEmail: msg.from.email,
        fromName: msg.from.name,
        senderType: (msg as MailMessage & { senderType?: string }).senderType,
        availableLabels: customLabels,
        users,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.labels?.length || data.assignedToId) setClassifySuggestion(data);
      })
      .catch(() => {})
      .finally(() => setClassifying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  // ── Identifier l'expéditeur ─────────────────────────────────
  async function identifySender() {
    if (senderInfo) return;
    setAiLoading("identify");
    try {
      const r = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "identify_sender", messages: thread.messages, senderEmail: firstMsg.from.email }),
      });
      const d = await r.json();
      setSenderInfo(d);
    } catch { /* silencieux */ }
    finally { setAiLoading(null); }
  }

  // Auto-identifier à l'ouverture
  if (!senderInfo && !aiLoading) identifySender();

  // ── Résumer ──────────────────────────────────────────────────
  async function summarize() {
    setAiLoading("summarize"); setAiSummary(null);
    try {
      const r = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarize", messages: thread.messages, threadSubject: thread.subject }),
      });
      const d = await r.json();
      if (d.error) { setAiSummary({ summary: `Erreur : ${d.error}`, points: [] }); return; }
      setAiSummary(d);
    } catch (e) { setAiSummary({ summary: `Erreur réseau : ${e instanceof Error ? e.message : String(e)}`, points: [] }); }
    finally { setAiLoading(null); }
  }

  // ── Proposer une réponse ────────────────────────────────────
  async function runFullAnalysis() {
    const email = firstMsg?.from?.email || lastMsg?.from?.email;
    if (!email) return;
    setAiLoading("full"); setFullAnalysis(null);
    try {
      const r = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "full_analysis", messages: [], senderEmail: email }),
      });
      const d = await r.json();
      if (d.error) return;
      setFullAnalysis(d);
    } catch { /* silencieux */ }
    finally { setAiLoading(null); }
  }

  // Convertit un texte (avec sauts de ligne) en HTML pour l'éditeur riche
  function toHtml(txt: string): string {
    return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${(txt || "").replace(/\n/g, "<br/>")}</div>`;
  }

  async function draftReply() {
    setAiLoading("draft");
    try {
      const r = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft_reply", messages: thread.messages, threadSubject: thread.subject, senderEmail: lastMsg?.from?.email, length: aiLength }),
      });
      const d = await r.json();
      const draft = d.reply ?? "";
      // Ouvre la fenêtre de rédaction centrée (éditeur riche + signature),
      // pré-remplie avec le brouillon généré par Auguste.
      if (onForward) {
        onForward({ to: lastMsg.from.email, subject: reSubject(), body: toHtml(draft), accountId: thread.accountId });
      } else {
        setReplyBody(draft); setShowReply(true);
      }
    } catch { /* silencieux */ }
    finally { setAiLoading(null); }
  }

  // ── Suggérer une tâche ──────────────────────────────────────
  async function suggestTask() {
    setAiLoading("task");
    try {
      const r = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_task", messages: thread.messages, threadSubject: thread.subject }),
      });
      const d = await r.json();
      setTaskModal(d);
    } catch { /* silencieux */ }
    finally { setAiLoading(null); }
  }

  // ── Détecter un RDV ─────────────────────────────────────────
  async function detectRdv() {
    setAiLoading("rdv");
    try {
      const r = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect_rdv", messages: thread.messages, threadSubject: thread.subject }),
      });
      const d = await r.json();
      setRdvModal(d);
    } catch { /* silencieux */ }
    finally { setAiLoading(null); }
  }

  // ── Conseil juridique ───────────────────────────────────────
  async function askLegal() {
    if (!legalQuestion.trim()) return;
    setLegalLoading(true); setLegalError(""); setLegalResult(null);
    try {
      const resp = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "legal_advice", messages: thread.messages, threadSubject: thread.subject, question: legalQuestion }),
      });
      const data = await resp.json();
      if (data.error) { setLegalError(data.error); return; }
      setLegalResult(data);
    } catch { setLegalError("Erreur de connexion à Auguste"); }
    finally { setLegalLoading(false); }
  }

  function injectLegalInReply() {
    if (!legalResult) return;
    const block = `\n\n---\nSur le plan juridique :\n${legalResult.suggestion || legalResult.answer}`;
    setReplyBody(prev => prev + block);
    setShowReply(true);
    setShowLegal(false);
  }

  async function askResearch() {
    setResearchLoading(true); setResearchError(""); setResearchResult(null);
    try {
      const resp = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "research", messages: thread.messages, threadSubject: thread.subject, question: researchQuery }),
      });
      const data = await resp.json();
      if (data.error) { setResearchError(data.error); return; }
      setResearchResult(data);
    } catch { setResearchError("Erreur de connexion à Auguste"); }
    finally { setResearchLoading(false); }
  }

  function injectResearchInReply() {
    if (!researchResult) return;
    const block = `\n\n---\n${researchResult.suggestion || researchResult.summary}`;
    setReplyBody(prev => prev + block);
    setShowReply(true);
    setShowResearch(false);
  }

  // ── Génération réponse IA via Auguste ───────────────────────
  async function generateAIReply() {
    setGenerating(true); setAiError("");
    try {
      const resp = await fetch("/api/mail/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft_reply", messages: thread.messages, threadSubject: thread.subject, tone: aiTone, instruction: aiInstruction, length: aiLength, senderEmail: lastMsg?.from?.email }),
      });
      const data = await resp.json();
      if (data.error) { setAiError(data.error); return; }
      setReplyBody(data.reply ?? "");
    } catch { setAiError("Erreur de connexion à Auguste"); }
    finally { setGenerating(false); }
  }

  // ── Valider et créer la tâche ───────────────────────────────
  async function saveTask() {
    if (!taskModal) return;
    setTaskSaving(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       taskModal.title,
          description: taskModal.description,
          priority:    taskModal.priority === "urgente" ? "urgent" : taskModal.priority,
          assigneeId:  taskModal.assigneeId,
          dueDate:     taskModal.dueDate,
        }),
      });
      if (r.ok) {
        setTaskModal(null);
        setActionResult({ ok: true, msg: "✅ Tâche créée avec succès" });
        setTimeout(() => setActionResult(null), 4000);
      }
    } catch { /* silencieux */ }
    finally { setTaskSaving(false); }
  }

  // ── Valider et créer le RDV ─────────────────────────────────
  async function saveRdv() {
    if (!rdvModal || !rdvModal.found) return;
    setRdvSaving(true);
    try {
      const attendees = rdvModal.attendeeId
        ? [{ type: "user", id: rdvModal.attendeeId, name: rdvModal.attendeeName }]
        : lastMsg.from.email
          ? [{ type: "contact", name: lastMsg.from.name, email: lastMsg.from.email }]
          : [];

      const r = await fetch("/api/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:     rdvModal.title || thread.subject,
          start:     rdvModal.start || new Date().toISOString(),
          end:       rdvModal.end   || new Date(Date.now() + 3600000).toISOString(),
          location:  rdvModal.location,
          type:      rdvModal.type || "rdv",
          attendees,
        }),
      });
      if (r.ok) {
        setRdvModal(null);
        setActionResult({ ok: true, msg: "📅 Rendez-vous créé et invitations envoyées" });
        setTimeout(() => setActionResult(null), 4000);
      }
    } catch { /* silencieux */ }
    finally { setRdvSaving(false); }
  }

  // ── Répondre ────────────────────────────────────────────────
  function sendReply() {
    if (!replyBody.trim()) return;
    const msg: MailMessage = {
      id:       Date.now().toString(),
      threadId: thread.id,
      accountId: thread.accountId,
      from:    { name: account?.name ?? "Moi", email: account?.email ?? "moi@agence.fr" },
      to:      [{ name: lastMsg.from.name, email: lastMsg.from.email }],
      subject: `Re: ${thread.subject}`,
      body:    `<p>${replyBody.replace(/\n/g, "<br/>")}</p>`,
      bodyText: replyBody,
      date:    new Date().toISOString(),
      status:  "read",
      labels:  ["sent", ...Array.from(threadLabelIds).filter(l => l !== "inbox")],
      inReplyTo: lastMsg.id,
    };
    onReply(msg);
    setReplyBody("");
    setShowReply(false);
  }

  // ── Transfert + suggestion syndic → Tristan ─────────────────
  const SYNDIC_RE = /(syndic|copropri|assembl[ée]e g[ée]n[ée]rale|conseil syndical|tantièmes|charges de copropri|r[èe]glement de copropri)/i;
  const syndicHit = SYNDIC_RE.test(`${thread.subject} ${thread.messages.map(m => m.bodyText || "").join(" ").slice(0, 3000)}`);
  const tristan = users.find(u => (u.prenom || "").toLowerCase().startsWith("tristan"));

  function buildForwardBody(): string {
    const m = lastMsg;
    const orig = (m.bodyText || (m.body || "").replace(/<[^>]+>/g, "")).trim();
    return `\n\n---------- Message transféré ----------\nDe : ${m.from.name || ""} <${m.from.email}>\nDate : ${new Date(m.date).toLocaleString("fr-FR")}\nObjet : ${thread.subject}\n\n${orig}`;
  }
  function forward(to = "") {
    onForward?.({
      to,
      subject: /^tr\s*:/i.test(thread.subject) ? thread.subject : `Tr: ${thread.subject}`,
      body: toHtml(buildForwardBody()),
      accountId: thread.accountId,
    });
  }

  function reSubject() { return /^re\s*:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`; }

  // ── Répondre : à l'expéditeur, corps vide (l'historique reste visible au-dessus) ──
  function reply() {
    if (!onForward) { setShowReply(true); return; }
    onForward({ to: lastMsg.from.email, subject: reSubject(), body: "", accountId: thread.accountId });
  }

  // ── Répondre à tous : expéditeur en destinataire + autres (To/Cc d'origine) en copie ──
  function replyAll() {
    const myEmail = (account?.email || "").toLowerCase();
    const fromEmail = lastMsg.from.email;
    const others = [...(lastMsg.to || []), ...(lastMsg.cc || [])]
      .map(r => r.email)
      .filter(Boolean)
      .filter(e => {
        const le = e.toLowerCase();
        return le !== myEmail && le !== fromEmail.toLowerCase();
      });
    const cc = [...new Set(others)].join(", ");
    onForward?.({ to: fromEmail, cc, subject: reSubject(), body: "", accountId: thread.accountId });
  }

  const badge = senderInfo ? SENDER_BADGE[senderInfo.senderType] ?? SENDER_BADGE.unknown : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f9fafb", minWidth: 0, minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Titre + libellés */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.3, margin: 0 }}>{thread.subject}</h2>
              {badge && (
                <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0, border: `1px solid ${badge.color}30` }}>
                  {badge.label}{senderInfo?.name ? ` · ${senderInfo.name}` : ""}
                </span>
              )}
            </div>
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

          {/* Boutons droite : ★ 🗑 × */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <button onClick={onStar} title="Suivre"
              style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${threadLabelIds.has("starred") ? "#FDE68A" : "#e5e7eb"}`, background: threadLabelIds.has("starred") ? "#FEF9C3" : "#f9fafb", cursor: "pointer", fontSize: 14, color: threadLabelIds.has("starred") ? "#f59e0b" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>★</button>
            <button onClick={onTrash} title="Corbeille"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", cursor: "pointer", fontSize: 14, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
            <button onClick={onClose} title="Fermer"
              style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f3f4f6", cursor: "pointer", fontSize: 17, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#6b7280"; }}
            >×</button>
          </div>
        </div>

        {/* Bannière corbeille */}
        {threadLabelIds.has("trash") && (
          <div style={{ marginTop: 10, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#991B1B", flex: 1 }}>🗑 Ce message est dans la corbeille.</span>
            {onRestore && (
              <button onClick={onRestore}
                style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ↩ Restaurer
              </button>
            )}
            {onDeletePermanent && (
              <button onClick={() => { if (confirm("Supprimer définitivement ce message ? Cette action est irréversible.")) onDeletePermanent?.(); }}
                style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ✕ Supprimer définitivement
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Barre assignation / réponse / classification ── */}
      <div style={{ padding: "6px 20px", background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 12, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", flexShrink: 0 }}>

        {/* Suggestion de classification IA */}
        {classifying && <span style={{ fontSize: 11, color: "#9ca3af" }}>✦ Classification en cours…</span>}
        {classifySuggestion && classifySuggestion.labels.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: classifySuggestion.hasMemory ? "#EFF6FF" : "#FEF9C3", border: `1px solid ${classifySuggestion.hasMemory ? "#BFDBFE" : "#FDE68A"}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, flexWrap: "wrap" }}>
            <span style={{ color: classifySuggestion.hasMemory ? "#1D4ED8" : "#92400E", fontWeight: 600 }}>
              {classifySuggestion.hasMemory ? "🧠 Mémorisé :" : "✦ Auguste suggère :"}
            </span>
            {classifySuggestion.labels.map(lid => {
              const lbl = customLabels.find(l => l.id === lid);
              return lbl ? <span key={lid} style={{ background: lbl.color + "22", color: lbl.color, borderRadius: 4, padding: "1px 7px", fontWeight: 600, border: `1px solid ${lbl.color}44` }}>{lbl.name}</span> : null;
            })}
            {classifySuggestion.assignedToId && (() => {
              const u = users.find(u => u.id === classifySuggestion.assignedToId);
              return u ? <span style={{ background: "#EFF6FF", color: "#2563EB", borderRadius: 4, padding: "1px 7px", fontWeight: 600 }}>→ {u.prenom}</span> : null;
            })()}
            {classifySuggestion.reason && <span style={{ color: "#6b7280", fontStyle: "italic", fontSize: 10 }}>{classifySuggestion.reason}</span>}
            <button onClick={async () => {
              const msg = firstMsg || lastMsg;
              classifySuggestion.labels.forEach(lid => onApplyLabel(lid));
              if (classifySuggestion.assignedToId) setAssigned(classifySuggestion.assignedToId);
              // Mémoriser automatiquement à l'application
              if (msg?.from?.email) {
                setMemorySaving(true);
                await fetch("/api/mail/memory", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fromEmail: msg.from.email, labelIds: classifySuggestion.labels, assignedToId: classifySuggestion.assignedToId }),
                });
                setMemorySaving(false);
                setMemoryMsg("Mémorisé ✓");
                setTimeout(() => setMemoryMsg(""), 2000);
              }
              setClassifySuggestion(null);
            }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", marginLeft: 4 }}>
              {memorySaving ? "…" : "Appliquer & mémoriser"}
            </button>
            {classifySuggestion.hasMemory && (() => {
              const msg = firstMsg || lastMsg;
              return (
                <button onClick={async () => {
                  if (msg?.from?.email) {
                    await fetch(`/api/mail/memory?email=${encodeURIComponent(msg.from.email)}`, { method: "DELETE" });
                    setMemoryMsg("Oublié ✓");
                    setTimeout(() => setMemoryMsg(""), 2000);
                  }
                  setClassifySuggestion(null);
                }} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "2px 8px", fontSize: 10, color: "#6b7280", cursor: "pointer" }}>
                  Oublier
                </button>
              );
            })()}
            <button onClick={() => setClassifySuggestion(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}>×</button>
          </div>
        )}
        {memoryMsg && <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>{memoryMsg}</span>}

        {/* Doit répondre */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>Doit répondre :</span>
          <select
            value={assignedId ?? ""}
            onChange={e => setAssigned(e.target.value || null)}
            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontSize: 12, background: assignedUser ? "#EFF6FF" : "#f9fafb", color: assignedUser ? "#2563EB" : "#374151", fontWeight: assignedUser ? 600 : 400, outline: "none", cursor: "pointer" }}
          >
            <option value="">— Non assigné —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
          </select>
        </div>

        {/* Répondu */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setReplied(isReplied ? null : (users[0]?.id ?? null))}
            style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isReplied ? "#059669" : "#d1d5db"}`, background: isReplied ? "#059669" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}
          >
            {isReplied ? "✓" : ""}
          </button>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>Répondu par :</span>
          <select
            value={repliedById ?? ""}
            onChange={e => setReplied(e.target.value || null)}
            style={{ border: `1px solid ${isReplied ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 6, padding: "3px 8px", fontSize: 12, background: isReplied ? "#f0fdf4" : "#f9fafb", color: isReplied ? "#059669" : "#9ca3af", fontWeight: isReplied ? 600 : 400, outline: "none", cursor: "pointer" }}
          >
            <option value="">— Personne —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
          </select>
        </div>
      </div>

      {/* ── Annuaire : expéditeur inconnu ── */}
      {contactLookup && !contactLookup.found && senderEmail && (
        <div style={{ padding: "9px 20px", background: "#FFF7ED", borderBottom: "1px solid #FED7AA", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#9A3412", fontWeight: 600 }}>👤 Expéditeur inconnu</span>
          <span style={{ fontSize: 12, color: "#9A3412" }}>{firstMsg?.from?.name || senderEmail} n'est pas dans l'annuaire.</span>
          <select value={contactType} onChange={e => setContactType(e.target.value)}
            style={{ height: 28, border: "1px solid #FED7AA", borderRadius: 6, fontSize: 12, padding: "0 6px", background: "#fff", color: "#374151" }}>
            <option value="fournisseur">Fournisseur</option>
            <option value="proprietaire">Propriétaire</option>
            <option value="locataire">Locataire</option>
            <option value="direction">Direction</option>
            <option value="commercial">Agent commercial</option>
            <option value="tutelle">Tutelle</option>
            <option value="autre">Autre</option>
          </select>
          <button onClick={saveContact} disabled={savingContact}
            style={{ background: "#EA580C", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: savingContact ? 0.7 : 1 }}>
            {savingContact ? "Enregistrement…" : "+ Enregistrer dans l'annuaire"}
          </button>
        </div>
      )}
      {savedContact && (
        <div style={{ padding: "8px 20px", background: "#ECFDF5", borderBottom: "1px solid #A7F3D0", fontSize: 12, color: "#047857", fontWeight: 600, flexShrink: 0 }}>
          ✓ {savedContact} ajouté à l'annuaire ({contactType}).
        </div>
      )}

      {/* ── Suggestion Auguste : transférer au responsable syndic (Tristan) ── */}
      {onForward && syndicHit && tristan && (
        <div style={{ padding: "8px 20px", background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#1e3a8a" }}>✦ Ce message concerne le <strong>syndic</strong>. Le transférer à {tristan.prenom} ?</span>
          <button onClick={() => forward(tristan.email || "")}
            style={{ background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            ↪ Transférer à {tristan.prenom}
          </button>
        </div>
      )}

      {/* ── Barre d'actions IA ── */}
      <div style={{ padding: "10px 20px", background: "#FDFAF6", borderBottom: "1px solid #EDE8DF", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: "0.04em", marginRight: 4 }}>✦ Auguste</span>

        <AiBtn loading={aiLoading === "summarize"} onClick={summarize}       icon="📝" label="Résumer" />
        <AiBtn loading={aiLoading === "draft"}     onClick={draftReply}      icon="✍" label="Brouillon IA" />
        <AiBtn loading={aiLoading === "task"}      onClick={suggestTask}     icon="✅" label="Créer une tâche" />
        <AiBtn loading={aiLoading === "rdv"}       onClick={detectRdv}       icon="📅" label="Valider un RDV" />
        <AiBtn loading={aiLoading === "full"}      onClick={runFullAnalysis} icon="🔍" label="Analyse complète" />
        <AiBtn loading={false} onClick={() => { setShowLegal(s => !s); setLegalResult(null); setLegalError(""); }} icon="⚖" label="Juridique" active={showLegal} />
        <AiBtn loading={researchLoading} onClick={() => { setShowResearch(s => !s); setResearchResult(null); setResearchError(""); }} icon="🌐" label="Recherche" active={showResearch} />

        {actionResult && (
          <span style={{ fontSize: 12, color: actionResult.ok ? "#059669" : "#dc2626", fontWeight: 500, marginLeft: 8 }}>
            {actionResult.msg}
          </span>
        )}

      </div>

      {/* Panneau résumé */}
      {aiSummary && (
        <div style={{ background: GOLD_BG, borderBottom: `1px solid ${BORDER}`, padding: "12px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 6 }}>📝 Résumé de la conversation</div>
              <p style={{ fontSize: 13, color: "#374151", margin: "0 0 8px", lineHeight: 1.6 }}>{aiSummary.summary}</p>
              {aiSummary.points?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                  {aiSummary.points.map((p, i) => (
                    <li key={i} style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setAiSummary(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, flexShrink: 0, marginLeft: 12 }}>×</button>
          </div>
        </div>
      )}

      {/* Panneau analyse complète */}
      {fullAnalysis && (
        <div style={{ background: "#F0F7FF", borderBottom: "1px solid #BFDBFE", padding: "14px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8" }}>🔍 Analyse complète — {fullAnalysis.name || firstMsg?.from?.name}</span>
              <span style={{ fontSize: 11, background: "#DBEAFE", color: "#1D4ED8", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{fullAnalysis.totalInDb ?? fullAnalysis.totalEmails} emails en base</span>
              <span style={{ fontSize: 11, background: fullAnalysis.sentiment === "positif" ? "#DCFCE7" : fullAnalysis.sentiment === "négatif" ? "#FEE2E2" : "#F3F4F6", color: fullAnalysis.sentiment === "positif" ? "#15803D" : fullAnalysis.sentiment === "négatif" ? "#DC2626" : "#6B7280", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                {fullAnalysis.sentiment === "positif" ? "😊" : fullAnalysis.sentiment === "négatif" ? "😟" : "😐"} {fullAnalysis.sentiment}
              </span>
              <span style={{ fontSize: 11, color: "#6B7280" }}>1er contact : {fullAnalysis.firstContact} · Dernier : {fullAnalysis.lastContact}</span>
            </div>
            <button onClick={() => setFullAnalysis(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 16 }}>×</button>
          </div>

          <p style={{ fontSize: 13, color: "#1E3A5F", margin: "0 0 10px", lineHeight: 1.6 }}>{fullAnalysis.summary}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {fullAnalysis.topics?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 5 }}>📌 Sujets abordés</div>
                <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 2 }}>
                  {fullAnalysis.topics.map((t, i) => <li key={i} style={{ fontSize: 12, color: "#374151" }}>{t}</li>)}
                </ul>
              </div>
            )}
            {fullAnalysis.actions?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 5 }}>⚡ Actions à faire</div>
                <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 2 }}>
                  {fullAnalysis.actions.map((a, i) => <li key={i} style={{ fontSize: 12, color: "#374151" }}>{a}</li>)}
                </ul>
              </div>
            )}
            {fullAnalysis.notes && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 5 }}>💡 Observations</div>
                <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5 }}>{fullAnalysis.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Panneau juridique ── */}
      {showLegal && (
        <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "14px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>⚖ Conseil juridique — Auguste</span>
            <button onClick={() => setShowLegal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
          </div>

          {/* Champ question */}
          <div style={{ display: "flex", gap: 8, marginBottom: legalResult ? 14 : 0 }}>
            <input
              value={legalQuestion}
              onChange={e => setLegalQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askLegal()}
              placeholder="Ex : Délai légal de préavis pour un F2 en zone tendue ? Que dit la loi ALUR sur les charges récupérables ?"
              style={{ flex: 1, height: 34, border: "1px solid #BBF7D0", borderRadius: 8, padding: "0 12px", fontSize: 12, outline: "none", background: "#fff" }}
            />
            <button onClick={askLegal} disabled={legalLoading || !legalQuestion.trim()}
              style={{ background: "#15803D", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: legalLoading || !legalQuestion.trim() ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {legalLoading ? "…" : "✦ Analyser"}
            </button>
          </div>

          {legalError && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{legalError}</div>}

          {/* Résultat */}
          {legalResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Réponse principale */}
              <div style={{ background: "#fff", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Analyse</div>
                <p style={{ fontSize: 13, color: "#1C1A17", margin: 0, lineHeight: 1.65 }}>{legalResult.answer}</p>
              </div>

              {/* Articles de loi */}
              {legalResult.articles?.length > 0 && (
                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "10px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Textes de référence</div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                    {legalResult.articles.map((a, i) => <li key={i} style={{ fontSize: 12, color: "#1e40af" }}>{a}</li>)}
                  </ul>
                </div>
              )}

              {/* Points d'attention */}
              {legalResult.warnings?.length > 0 && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Points d'attention</div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                    {legalResult.warnings.map((w, i) => <li key={i} style={{ fontSize: 12, color: "#92400E" }}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Suggestion de formulation + bouton intégrer */}
              {legalResult.suggestion && (
                <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Formulation suggérée</div>
                  <p style={{ fontSize: 12, color: "#166534", margin: "0 0 10px", lineHeight: 1.6, fontStyle: "italic" }}>{legalResult.suggestion}</p>
                  <button onClick={injectLegalInReply}
                    style={{ background: "#15803D", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ↳ Intégrer dans la réponse
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Panneau recherche ── */}
      {showResearch && (
        <div style={{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", padding: "14px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8" }}>🌐 Recherche — Auguste</span>
            <button onClick={() => setShowResearch(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: researchResult ? 14 : 0 }}>
            <input
              value={researchQuery}
              onChange={e => setResearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askResearch()}
              placeholder={`Ex : délai préavis zone tendue, jurisprudence bail commercial… (laissez vide pour analyser l'email)`}
              style={{ flex: 1, height: 34, border: "1px solid #BFDBFE", borderRadius: 8, padding: "0 12px", fontSize: 12, outline: "none", background: "#fff" }}
            />
            <button onClick={askResearch} disabled={researchLoading}
              style={{ background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: researchLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {researchLoading ? "…" : "🔍 Rechercher"}
            </button>
          </div>
          {researchLoading && <div style={{ fontSize: 12, color: "#1D4ED8", fontStyle: "italic" }}>Auguste recherche sur le web et dans l'historique des mails…</div>}
          {researchError && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{researchError}</div>}

          {researchResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#fff", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Synthèse</div>
                <p style={{ fontSize: 13, color: "#1C1A17", margin: 0, lineHeight: 1.65 }}>{researchResult.summary}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: researchResult.mailInsights?.length ? "1fr 1fr" : "1fr", gap: 10 }}>
                {researchResult.keyPoints?.length > 0 && (
                  <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "10px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Points clés</div>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                      {researchResult.keyPoints.map((p, i) => <li key={i} style={{ fontSize: 12, color: "#0c4a6e" }}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {researchResult.mailInsights?.length > 0 && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "10px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Historique mails</div>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                      {researchResult.mailInsights.map((p, i) => <li key={i} style={{ fontSize: 12, color: "#166534" }}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {researchResult.webSources?.length > 0 && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Sources web</div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                    {researchResult.webSources.map((s, i) => <li key={i} style={{ fontSize: 11, color: "#92400E" }}>{s}</li>)}
                  </ul>
                </div>
              )}

              {researchResult.suggestion && (
                <div style={{ background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <p style={{ fontSize: 12, color: "#1e40af", margin: 0, flex: 1, lineHeight: 1.6, fontStyle: "italic" }}>{researchResult.suggestion}</p>
                  <button onClick={injectResearchInReply}
                    style={{ background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ↳ Intégrer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Zone réponse — modal flottante sur la popup ── */}
      {showReply && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "flex-end", background: "rgba(0,0,0,0.18)", pointerEvents: "all" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowReply(false); setReplyBody(""); } }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#fff", borderRadius: replySize === "full" ? 0 : "16px 16px 0 0", boxShadow: "0 -8px 32px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", height: replySize === "full" ? "100%" : undefined, maxHeight: replySize === "full" ? "100%" : replySize === "large" ? "92%" : "75%", overflow: "hidden" }}>

            {/* En-tête */}
            <div style={{ background: GOLD_BG, padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, flexShrink: 0 }}>✦ Réponse à</span>
              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMsg.from.name || lastMsg.from.email}</span>
              {/* Agrandir / plein écran */}
              <button onClick={() => setReplySize(s => s === "large" ? "normal" : "large")} title={replySize === "large" ? "Réduire" : "Agrandir"}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#374151", flexShrink: 0, lineHeight: 1 }}>
                {replySize === "large" ? "❏" : "⤢"}
              </button>
              <button onClick={() => setReplySize(s => s === "full" ? "normal" : "full")} title={replySize === "full" ? "Quitter le plein écran" : "Plein écran"}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#374151", flexShrink: 0, lineHeight: 1 }}>
                {replySize === "full" ? "🗗" : "⛶"}
              </button>
              {/* Bouton fermer bien visible */}
              <button onClick={() => { setShowReply(false); setReplyBody(""); }}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", border: "1px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#374151", fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>

            {/* Outils IA */}
            <div style={{ padding: "8px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flexShrink: 0, background: "#fafafa" }}>
              <select value={aiTone} onChange={e => setAiTone(e.target.value)} style={{ height: 26, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, padding: "0 6px", background: "#fff", color: "#374151" }}>
                <option value="professionnel">Professionnel</option>
                <option value="cordial">Cordial</option>
                <option value="formel">Formel</option>
                <option value="concis">Concis</option>
              </select>
              <select value={aiLength} onChange={e => setAiLength(e.target.value)} title="Longueur de la réponse" style={{ height: 26, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, padding: "0 6px", background: "#fff", color: "#374151" }}>
                <option value="court">Court</option>
                <option value="moyen">Moyen</option>
                <option value="détaillé">Détaillé</option>
              </select>
              <input value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} placeholder="Instruction IA…" style={{ flex: 1, minWidth: 100, height: 26, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, padding: "0 8px", outline: "none", background: "#fff" }} />
              <button onClick={generateAIReply} disabled={generating} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: generating ? 0.7 : 1, whiteSpace: "nowrap" }}>
                {generating ? "…" : "✦ Générer"}
              </button>
              {aiError && <span style={{ fontSize: 11, color: "#dc2626", width: "100%" }}>{aiError}</span>}
            </div>

            {/* Textarea scrollable */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 120 }}>
              <textarea
                autoFocus
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder={generating ? "Auguste rédige la réponse…" : "Votre réponse…"}
                style={{ width: "100%", minHeight: 160, height: "100%", border: "none", padding: "14px 20px", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", background: generating ? "#fafaf8" : "#fff", color: generating ? "#9ca3af" : "#111827", display: "block" }}
              />
            </div>

            {/* Actions */}
            <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 8, alignItems: "center", flexShrink: 0, background: "#fff" }}>
              <button onClick={sendReply} disabled={!replyBody.trim() || generating}
                style={{ background: replyBody.trim() && !generating ? GOLD : "#e5e7eb", color: replyBody.trim() && !generating ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ↑ Envoyer
              </button>
              <button onClick={() => { setShowReply(false); setReplyBody(""); }}
                style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", color: "#374151" }}>
                Annuler
              </button>
              {replyBody && (
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>
                  {replyBody.length} caractères
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages — dédupliqués par messageId, on garde celui avec le plus de contenu */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "scroll" }}>
        <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
        {(() => {
          const seen = new Map<string, MailMessage>();
          for (const msg of thread.messages) {
            const key = msg.id.replace(/^[^-]+-/, "");
            const existing = seen.get(key);
            if (!existing || (msg.body || msg.bodyText || "").length > (existing.body || existing.bodyText || "").length) {
              seen.set(key, msg);
            }
          }
          const deduped = Array.from(seen.values());
          return deduped.map((msg, i) => (
            <MessageBubble key={msg.id} msg={msg} isLast={i === deduped.length - 1} loadingBody={loadingBody} />
          ));
        })()}
        </div>
      </div>

      {/* Actions mail (bas, style Gmail) — quand le panneau réponse est fermé */}
      {!showReply && (
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px", background: "#fff", display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button onClick={reply}
            style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            ↩ Répondre
          </button>
          {onForward && (
            <button onClick={replyAll}
              style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: GOLD, fontWeight: 500 }}>
              ↩↩ Répondre à tous
            </button>
          )}
          {onForward && (
            <button onClick={() => forward("")}
              style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: GOLD, fontWeight: 500 }}>
              ↪ Transférer
            </button>
          )}
        </div>
      )}

      {/* Modal tâche */}
      {taskModal && (
        <Modal title="✅ Créer une tâche" onClose={() => setTaskModal(null)}>
          <Field label="Titre">
            <input value={taskModal.title} onChange={e => setTaskModal(t => t ? { ...t, title: e.target.value } : t)}
              style={inputStyle} />
          </Field>
          <Field label="Description">
            <textarea value={taskModal.description} onChange={e => setTaskModal(t => t ? { ...t, description: e.target.value } : t)}
              rows={3} style={{ ...inputStyle, resize: "none", height: "auto", padding: "8px" }} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Priorité">
              <select value={taskModal.priority} onChange={e => setTaskModal(t => t ? { ...t, priority: e.target.value } : t)} style={inputStyle}>
                <option value="urgent">Urgente</option>
                <option value="haute">Haute</option>
                <option value="moyenne">Moyenne</option>
                <option value="basse">Basse</option>
              </select>
            </Field>
            <Field label="Assigné à">
              <input value={taskModal.assigneeName || ""} onChange={e => setTaskModal(t => t ? { ...t, assigneeName: e.target.value } : t)}
                placeholder="Nom du responsable" style={inputStyle} />
            </Field>
          </div>
          {taskModal.dueDate && (
            <Field label="Échéance">
              <input type="date" value={taskModal.dueDate} onChange={e => setTaskModal(t => t ? { ...t, dueDate: e.target.value } : t)} style={inputStyle} />
            </Field>
          )}
          <Confidence value={taskModal.confidence} />
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={saveTask} disabled={taskSaving} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {taskSaving ? "Création..." : "Créer la tâche"}
            </button>
            <button onClick={() => setTaskModal(null)} style={{ flex: 1, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 0", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Modal RDV */}
      {rdvModal && (
        <Modal title="📅 Valider un rendez-vous" onClose={() => setRdvModal(null)}>
          {!rdvModal.found ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Aucun rendez-vous détecté dans cet échange.</p>
          ) : (
            <>
              <Field label="Titre">
                <input value={rdvModal.title} onChange={e => setRdvModal(r => r ? { ...r, title: e.target.value } : r)}
                  style={inputStyle} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Début">
                  <input type="datetime-local" value={rdvModal.start?.slice(0, 16) || ""} onChange={e => setRdvModal(r => r ? { ...r, start: e.target.value } : r)} style={inputStyle} />
                </Field>
                <Field label="Fin">
                  <input type="datetime-local" value={rdvModal.end?.slice(0, 16) || ""} onChange={e => setRdvModal(r => r ? { ...r, end: e.target.value } : r)} style={inputStyle} />
                </Field>
              </div>
              <Field label="Lieu">
                <input value={rdvModal.location || ""} onChange={e => setRdvModal(r => r ? { ...r, location: e.target.value } : r)}
                  placeholder="Adresse ou visioconférence" style={inputStyle} />
              </Field>
              <Field label="Type">
                <select value={rdvModal.type || "rdv"} onChange={e => setRdvModal(r => r ? { ...r, type: e.target.value } : r)} style={inputStyle}>
                  <option value="rdv">Rendez-vous</option>
                  <option value="visite">Visite</option>
                  <option value="edl">État des lieux</option>
                  <option value="signature">Signature</option>
                  <option value="formation">Formation</option>
                  <option value="autre">Autre</option>
                </select>
              </Field>
              {rdvModal.attendeeName && (
                <Field label="Participant détecté">
                  <input value={rdvModal.attendeeName} readOnly style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280" }} />
                </Field>
              )}
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#166534", marginTop: 8 }}>
                📧 Une invitation email sera envoyée aux participants
              </div>
              <Confidence value={rdvModal.confidence} />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={saveRdv} disabled={rdvSaving} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {rdvSaving ? "Création..." : "Créer le RDV"}
                </button>
                <button onClick={() => setRdvModal(null)} style={{ flex: 1, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 0", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              </div>
            </>
          )}
        </Modal>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mail-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #374151; }
        .mail-body img { max-width: 100%; height: auto; border-radius: 4px; }
        .mail-body a { color: #B8966A; }
        .mail-body blockquote { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #e5e7eb; color: #6b7280; background: #f9fafb; border-radius: 0 4px 4px 0; }
        .mail-body pre { white-space: pre-wrap; }
        .mail-body table { border-collapse: collapse; max-width: 100%; }
        .mail-body td, .mail-body th { padding: 4px 8px; }
      `}</style>
    </div>
  );
}

// ── Sous-composants ──────────────────────────────────────────

function AiBtn({ loading, onClick, icon, label, active }: { loading: boolean; onClick: () => void; icon: string; label: string; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, background: active ? "#F0FDF4" : loading ? "#f3f4f6" : "#fff", border: `1px solid ${active ? "#86EFAC" : loading ? "#e5e7eb" : "#E8D9C0"}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: loading ? "default" : "pointer", color: active ? "#15803D" : loading ? "#9ca3af" : "#5C5449", fontWeight: active ? 600 : 500, transition: "all 0.15s" }}
      onMouseEnter={e => !loading && !active && (e.currentTarget.style.borderColor = GOLD, e.currentTarget.style.color = GOLD)}
      onMouseLeave={e => !loading && !active && (e.currentTarget.style.borderColor = "#E8D9C0", e.currentTarget.style.color = "#5C5449")}
    >
      {loading ? <Spinner /> : icon} {label}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 480, maxWidth: "95vw", background: "#fff", borderRadius: 14, zIndex: 101, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#1C1A17", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#9ca3af" }}>
      <span>Confiance IA :</span>
      <div style={{ flex: 1, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #e5e7eb", borderTopColor: GOLD, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 34, border: "1px solid #e5e7eb", borderRadius: 7, padding: "0 10px",
  fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

// ── MessageBubble ────────────────────────────────────────────

function MessageBubble({ msg, isLast, loadingBody }: { msg: MailMessage; isLast: boolean; loadingBody?: boolean }) {
  const [expanded, setExpanded] = useState(isLast);
  const date = new Date(msg.date);
  const initials = (msg.from.name || msg.from.email).charAt(0).toUpperCase();
  const COLORS = ["#B8966A", "#059669", "#2563EB", "#7C3AED", "#DC2626", "#D97706"];
  const avatarColor = COLORS[msg.from.email.charCodeAt(0) % COLORS.length];
  const hasBody = (msg.body && msg.body.trim().length > 0) || (msg.bodyText && msg.bodyText.trim().length > 0);
  const attachments: MailAttachment[] = msg.attachments ?? [];

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div onClick={() => setExpanded(s => !s)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: expanded ? "#fff" : "#fafafa" }}
        onMouseEnter={e => !expanded && (e.currentTarget.style.background = "#f3f4f6")}
        onMouseLeave={e => !expanded && (e.currentTarget.style.background = "#fafafa")}
      >
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor + "20", border: `2px solid ${avatarColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{msg.from.name || msg.from.email}</span>
              {msg.from.name && <span style={{ fontSize: 11, color: "#9ca3af" }}>&lt;{msg.from.email}&gt;</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {attachments.length > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>📎 {attachments.length}</span>}
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ color: "#d1d5db", fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
            </div>
          </div>
          {!expanded && <div style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.bodyText?.replace(/\s+/g, " ").slice(0, 100) || "(Chargement...)"}</div>}
          {expanded  && <div style={{ fontSize: 11, color: "#9ca3af" }}>À : {msg.to.map(t => t.name ? `${t.name} <${t.email}>` : t.email).join(", ")}</div>}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6" }}>
          {loadingBody && !hasBody ? (
            <div style={{ padding: "20px 20px 20px 64px", display: "flex", alignItems: "center", gap: 10, color: "#9ca3af", fontSize: 13 }}>
              <Spinner /> Chargement du message...
            </div>
          ) : !hasBody ? (
            <div style={{ padding: "20px 20px 20px 64px", color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Corps non disponible</div>
          ) : (
            <div style={{ padding: "16px 20px 16px 64px" }}>
              {msg.body && msg.body.trim() ? (
                <div className="mail-body" dangerouslySetInnerHTML={{ __html: msg.body }} />
              ) : (
                <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
                  {msg.bodyText}
                </pre>
              )}
            </div>
          )}

          {attachments.length > 0 && (
            <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 20px 12px 64px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {attachments.map(att => <AttachmentChip key={att.id} att={att} />)}
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
    const byteStr = atob(att.data);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = att.name; a.click();
    URL.revokeObjectURL(url);
  }
  const icon = (() => {
    const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
    if (["jpg","jpeg","png","gif","webp"].includes(ext)) return "🖼";
    if (ext === "pdf") return "📄";
    if (["doc","docx"].includes(ext)) return "📝";
    if (["xls","xlsx","csv"].includes(ext)) return "📊";
    if (["zip","rar","7z"].includes(ext)) return "🗜";
    return "📎";
  })();
  const sizeStr = att.size > 1024*1024 ? `${(att.size/1024/1024).toFixed(1)} Mo` : `${Math.round(att.size/1024)} Ko`;

  return (
    <button onClick={att.data ? download : undefined}
      style={{ display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: att.data ? "pointer" : "default", color: "#374151" }}
      onMouseEnter={e => att.data && (e.currentTarget.style.background = GOLD_BG)}
      onMouseLeave={e => att.data && (e.currentTarget.style.background = "#f9fafb")}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>{sizeStr}{att.data ? " · Télécharger" : ""}</div>
      </div>
    </button>
  );
}
