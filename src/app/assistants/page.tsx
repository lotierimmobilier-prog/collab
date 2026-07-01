"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Markdown from "@/components/Markdown";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const BLUE = "#2563EB"; const GREEN = "#2F855A";

const ROLES = [
  { id: "agent",        label: "Agent commercial" },
  { id: "gestionnaire", label: "Gestionnaire" },
  { id: "syndic",       label: "Syndic" },
  { id: "dirigeant",    label: "Direction" },
];
// Modèles Anthropic proposés. La direction peut aussi saisir un identifiant de
// modèle précis (ex. un modèle Opus) via l'option « Autre ».
const MODEL_OPTIONS = [
  { id: "fast",  label: "Haiku 4.5 — rapide & économique" },
  { id: "smart", label: "Sonnet 4.6 — équilibré (recommandé)" },
  { id: "fable", label: "Fable 5 — créatif" },
];
const CUSTOM = "__custom__";
const isPresetModel = (m: string) => MODEL_OPTIONS.some(o => o.id === m);
function modelLabel(m: string) {
  const o = MODEL_OPTIONS.find(x => x.id === m);
  if (o) return o.label.split(" — ")[0];
  return m === "max" ? "Qualité max" : m;
}

interface AgentPublic { id: string; name: string; specialty: string | null; description: string | null; icon: string | null; color: string | null; photo: string | null; cv: string | null }
interface Doc { id: string; name: string; chars: number; createdAt: string }
interface AgentFull extends AgentPublic { model: string; systemPrompt: string; accessRoles: string[] | null; active: boolean; order: number; docs: Doc[]; _count?: { chunks: number } }

// Avatar : photo si dispo, sinon pastille avec l'emoji.
function Avatar({ a, size = 48 }: { a: { photo: string | null; icon: string | null; color: string | null }; size?: number }) {
  const c = a.color || GOLD;
  if (a.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.photo} alt="" style={{ width: size, height: size, borderRadius: size * 0.27, objectFit: "cover", border: `1px solid ${BORDER}` }} />;
  }
  return <div style={{ width: size, height: size, borderRadius: size * 0.27, background: `${c}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5 }}>{a.icon || "🤖"}</div>;
}

// Redimensionne une image (fichier) en data-URL compacte (max 512 px, JPEG).
function fileToAvatar(file: File, max = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lecture"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
interface ChatAtt { name: string; mediaType: string; data?: string; text?: string }
interface ChatMsg { role: "user" | "assistant"; content: string; attachments?: ChatAtt[] }

const ATT_IMG = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const TEXT_EXT = /\.(txt|text|md|markdown|json|csv|tsv|log|xml|ya?ml|html?|ini|conf|cfg|tex|srt|vtt)$/i;
const TEXT_MIME = ["application/json", "application/xml", "application/x-yaml", "application/yaml", "application/csv", "application/rtf"];
const MAX_TEXT_CHARS = 400_000;

type AttKind = "pdf" | "image" | "text" | null;
function attKind(f: File): AttKind {
  if (f.type === "application/pdf") return "pdf";
  if (ATT_IMG.includes(f.type)) return "image";
  if (f.type.startsWith("text/") || TEXT_MIME.includes(f.type)) return "text";
  if (TEXT_EXT.test(f.name)) return "text";
  return null;
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(new Error("lecture"));
    r.readAsDataURL(f);
  });
}
function fileToText(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ""));
    r.onerror = () => rej(new Error("lecture"));
    r.readAsText(f);
  });
}

export default function AssistantsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { roleId?: string })?.roleId ?? "";
  const isDir = ["admin", "dirigeant", "direction"].includes(role);

  const [tab, setTab] = useState<"gallery" | "team" | "manage">("gallery");
  const [agents, setAgents] = useState<AgentPublic[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [active, setActive] = useState<AgentPublic | null>(null);

  const load = useCallback(() => {
    fetch("/api/ai-agents").then(r => r.ok ? r.json() : null)
      .then(d => { setAgents(d?.agents ?? []); setFavorites(d?.favorites ?? []); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleFav = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    fetch("/api/ai-agents/favorite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: id }) }).catch(() => {});
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="assistants" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1080, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>🤖 Assistants IA</h1>
          <div style={{ display: "flex", gap: 6 }}>
            <TabBtn active={tab === "gallery"} onClick={() => { setTab("gallery"); setActive(null); }} label="Galerie" />
            <TabBtn active={tab === "team"} onClick={() => { setTab("team"); setActive(null); }} label="🎼 Équipe" />
            {isDir && <TabBtn active={tab === "manage"} onClick={() => { setTab("manage"); setActive(null); }} label="⚙️ Gérer" />}
          </div>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 18 }}>
          Des spécialistes dédiés, en plus d'Auguste (le généraliste). Chacun a son domaine, sa personnalité et sa base de connaissance.
        </p>

        {tab === "gallery" && !active && <Gallery agents={agents} favorites={favorites} onToggleFav={toggleFav} onPick={setActive} />}
        {tab === "gallery" && active && <Chat agent={active} onBack={() => setActive(null)} />}
        {tab === "team" && <Team agents={agents} />}
        {tab === "manage" && isDir && <Manage onChanged={load} />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 9,
      background: active ? GOLD : "#fff", color: active ? "#fff" : "#6b7280", border: `1px solid ${active ? GOLD : BORDER}`,
    }}>{label}</button>
  );
}

// ════════════ Équipe (multi-agents, Auguste chef d'orchestre) ════════════

interface Contribution { agentId: string; agentName: string; icon?: string | null; color?: string | null; question: string; answer: string }
function Team({ agents }: { agents: AgentPublic[] }) {
  const [objective, setObjective] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ contributions: Contribution[]; synthesis: string } | null>(null);
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function run() {
    if (!objective.trim()) { setErr("Décrivez l'objectif."); return; }
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch("/api/ai-agents/orchestrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective: objective.trim(), agentIds: sel.size ? [...sel] : undefined }) });
      const j = await r.json();
      if (r.ok && j.ok) setRes({ contributions: j.contributions ?? [], synthesis: j.synthesis ?? "" });
      else setErr(j.error || "Échec de l'orchestration.");
    } catch { setErr("Erreur réseau."); }
    setBusy(false);
  }

  return (
    <div>
      <div style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>🎼 Auguste, chef d&apos;orchestre</div>
        <p style={{ fontSize: 12.5, color: "#6b7280", margin: "0 0 12px" }}>Donnez un objectif : Auguste choisit les assistants pertinents, leur délègue une partie du travail, puis synthétise leurs réponses.</p>
        <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3} placeholder="Ex. Rédige une annonce pour un T3 à Béziers et vérifie sa conformité juridique."
          style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none" }} />
        {agents.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 6 }}>Assistants à mobiliser (facultatif — sinon Auguste choisit) :</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {agents.map(a => (
                <button key={a.id} onClick={() => toggle(a.id)} style={{ padding: "5px 11px", fontSize: 12, borderRadius: 999, cursor: "pointer", fontWeight: 600, background: sel.has(a.id) ? (a.color || GOLD) : "#fff", color: sel.has(a.id) ? "#fff" : "#6b7280", border: `1px solid ${sel.has(a.id) ? (a.color || GOLD) : BORDER}` }}>{a.icon || "🤖"} {a.name}</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={run} disabled={busy} style={{ marginTop: 12, background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{busy ? "Auguste orchestre…" : "▶ Lancer l'équipe"}</button>
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: "#B42318" }}>⚠️ {err}</div>}
      </div>

      {res && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {res.contributions.map((c, i) => (
            <div key={i} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: (c.color || GOLD) + "18", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: DARK }}>{c.icon || "🤖"} {c.agentName}</div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 6, fontStyle: "italic" }}>« {c.question} »</div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}><Markdown text={c.answer} /></div>
              </div>
            </div>
          ))}
          <div style={{ background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1D4ED8", marginBottom: 8 }}>✦ Synthèse d&apos;Auguste</div>
            <div style={{ fontSize: 13.5, color: "#1E3A5F", lineHeight: 1.6 }}><Markdown text={res.synthesis} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════ Galerie ════════════

function Gallery({ agents, favorites, onToggleFav, onPick }: { agents: AgentPublic[]; favorites: string[]; onToggleFav: (id: string) => void; onPick: (a: AgentPublic) => void }) {
  const [cvAgent, setCvAgent] = useState<AgentPublic | null>(null);
  if (!agents.length) return <div style={{ color: "#9ca3af", fontSize: 13, padding: 28, textAlign: "center" }}>Aucun assistant disponible pour le moment.</div>;
  const favSet = new Set(favorites);
  // Favoris en tête, puis ordre d'origine.
  const ordered = [...agents].sort((a, b) => (favSet.has(b.id) ? 1 : 0) - (favSet.has(a.id) ? 1 : 0));
  const hasFav = agents.some(a => favSet.has(a.id));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
        {ordered.map(a => {
          const c = a.color || GOLD;
          const fav = favSet.has(a.id);
          return (
            <div key={a.id} style={{
              position: "relative", background: "#fff", border: `1px solid ${fav ? GOLD : BORDER}`, borderRadius: 16, padding: 18,
              boxShadow: fav ? "0 2px 10px rgba(184,150,106,0.18)" : "0 1px 4px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10, borderTop: `3px solid ${c}`,
            }}>
              {/* Étoile favori */}
              <button onClick={() => onToggleFav(a.id)} title={fav ? "Retirer des favoris" : "Mettre en favori"} style={{
                position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer",
                fontSize: 18, lineHeight: 1, color: fav ? GOLD : "#d1d5db",
              }}>{fav ? "★" : "☆"}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 22 }}>
                <Avatar a={a} size={52} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{a.name}</div>
                  {a.specialty && <div style={{ fontSize: 12, fontWeight: 600, color: c }}>{a.specialty}</div>}
                </div>
              </div>
              {a.description && <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.45, flex: 1 }}>{a.description}</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                <button onClick={() => onPick(a)} style={{ flex: 1, background: c, color: "#fff", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Discuter</button>
                {a.cv && <button onClick={() => setCvAgent(a)} style={{ background: "#fff", color: c, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📄 CV</button>}
              </div>
            </div>
          );
        })}
      </div>
      {!hasFav && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>★ Astuce : mettez vos assistants préférés en favori pour les épingler en tête.</div>}
      {cvAgent && <CvModal agent={cvAgent} onClose={() => setCvAgent(null)} onChat={() => { const a = cvAgent; setCvAgent(null); onPick(a); }} />}
    </>
  );
}

function CvModal({ agent, onClose, onChat }: { agent: AgentPublic; onClose: () => void; onChat: () => void }) {
  const c = agent.color || GOLD;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "min(560px,100%)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px", borderBottom: `1px solid ${BORDER}`, background: `${c}0D`, borderRadius: "18px 18px 0 0" }}>
          <Avatar a={agent} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: DARK }}>{agent.name}</div>
            {agent.specialty && <div style={{ fontSize: 13, fontWeight: 600, color: c }}>{agent.specialty}</div>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", fontSize: 13.5, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{agent.cv}</div>
        <div style={{ padding: "0 22px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "#fff", color: "#6b7280", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
          <button onClick={onChat} style={{ background: c, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Discuter avec {agent.name}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════ Chat ════════════

function Chat({ agent, onBack }: { agent: AgentPublic; onBack: () => void }) {
  const c = agent.color || GOLD;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [atts, setAtts] = useState<ChatAtt[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    const out = [...atts];
    for (const f of Array.from(files)) {
      if (out.length >= 5) { setErr("5 fichiers maximum."); break; }
      const kind = attKind(f);
      if (!kind) { setErr("Formats acceptés : PDF, image, ou texte (txt, md, json, csv, xml…)."); continue; }
      if (f.size > 8 * 1024 * 1024) { setErr(`« ${f.name} » dépasse 8 Mo.`); continue; }
      try {
        if (kind === "text") out.push({ name: f.name, mediaType: f.type || "text/plain", text: (await fileToText(f)).slice(0, MAX_TEXT_CHARS) });
        else out.push({ name: f.name, mediaType: f.type, data: await fileToBase64(f) });
      } catch { /* ignore */ }
    }
    setAtts(out);
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !atts.length) || busy) return;
    setErr("");
    const mine = atts;
    const next = [...messages, { role: "user" as const, content: text, attachments: mine.length ? mine : undefined }];
    setMessages(next); setInput(""); setAtts([]); setBusy(true);
    // On n'envoie les pièces jointes que sur le dernier message (allège la requête).
    const payload = next.map((m, i) => i === next.length - 1 ? m : { role: m.role, content: m.content });
    let res: { reply?: string; error?: string } | null = null;
    try {
      const r = await fetch(`/api/ai-agents/${agent.id}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      try { res = await r.json(); } catch { res = null; }
      if (!r.ok && !res?.error) {
        res = { error:
          r.status === 413 ? "Fichier trop volumineux pour être analysé. Essayez un fichier plus léger."
          : (r.status === 504 || r.status === 408 || r.status === 524) ? "L'analyse a pris trop de temps. Réessayez, ou joignez un document plus léger."
          : r.status >= 500 ? "Le service IA est momentanément indisponible. Réessayez dans un instant."
          : "Une erreur est survenue." };
      }
    } catch { res = { error: "Connexion impossible. Vérifiez votre réseau et réessayez." }; }
    setBusy(false);
    if (res?.reply) setMessages(m => [...m, { role: "assistant", content: res!.reply! }]);
    else { setErr(res?.error || "Une erreur est survenue."); setMessages(m => m.slice(0, -1)); setInput(text); setAtts(mine); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", minHeight: 480, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, background: `${c}0D` }}>
        <button onClick={onBack} style={{ border: "none", background: "none", fontSize: 20, color: "#6b7280", cursor: "pointer" }}>←</button>
        <Avatar a={agent} size={42} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: DARK }}>{agent.name}</div>
          {agent.specialty && <div style={{ fontSize: 12, color: c, fontWeight: 600 }}>{agent.specialty}</div>}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {!messages.length && (
          <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", margin: "auto", maxWidth: 420 }}>
            👋 Bonjour, je suis <b style={{ color: DARK }}>{agent.name}</b>. {agent.description || "Posez-moi votre question."}
            <div style={{ marginTop: 8, fontSize: 12 }}>📎 Vous pouvez joindre un PDF, une image ou un fichier texte (txt, json, md, csv…) à analyser — DPE, compromis, diagnostic…</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "10px 13px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.5,
              whiteSpace: m.role === "user" ? "pre-wrap" : "normal", wordBreak: "break-word",
              background: m.role === "user" ? c : "#F4F1EC", color: m.role === "user" ? "#fff" : DARK,
              borderBottomRightRadius: m.role === "user" ? 4 : 13, borderBottomLeftRadius: m.role === "user" ? 13 : 4,
            }}>
              {!!m.attachments?.length && <AttachmentRow atts={m.attachments} onUser={m.role === "user"} />}
              {m.role === "assistant" ? <Markdown text={m.content} /> : (m.content || null)}
            </div>
          </div>
        ))}
        {busy && <div style={{ fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>{agent.name} réfléchit…</div>}
        {err && <div style={{ fontSize: 12.5, color: RED, background: "#FEE2E2", borderRadius: 9, padding: "8px 12px" }}>{err}</div>}
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: 12 }}>
        {!!atts.length && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {atts.map((a, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, color: DARK, maxWidth: 200 }}>
                <span>{a.mediaType === "application/pdf" ? "📄" : a.text !== undefined ? "📝" : "🖼️"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                <button onClick={() => setAtts(p => p.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: RED, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input ref={fileRef} type="file" accept=".pdf,image/*,text/*,.txt,.md,.markdown,.json,.csv,.tsv,.log,.xml,.yaml,.yml,.html,.htm" multiple onChange={e => onFiles(e.target.files)} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} title="Joindre un fichier (PDF, image, texte)" style={{ background: "#fff", color: c, border: `1px solid ${BORDER}`, borderRadius: 11, padding: "10px 13px", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>📎</button>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={1}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Écrire à ${agent.name}…`}
            style={{ flex: 1, padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 11, fontSize: 13.5, resize: "none", maxHeight: 140, boxSizing: "border-box", fontFamily: "inherit" }} />
          <button onClick={send} disabled={busy || (!input.trim() && !atts.length)} style={{
            background: busy || (!input.trim() && !atts.length) ? "#d1d5db" : c, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: busy || (!input.trim() && !atts.length) ? "default" : "pointer",
          }}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

function AttachmentRow({ atts, onUser }: { atts: ChatAtt[]; onUser: boolean }) {
  const border = onUser ? "rgba(255,255,255,0.4)" : BORDER;
  const txt = onUser ? "#fff" : DARK;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      {atts.map((a, i) => a.data && a.mediaType !== "application/pdf" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`data:${a.mediaType};base64,${a.data}`} alt={a.name} style={{ maxWidth: 130, maxHeight: 130, borderRadius: 9, border: `1px solid ${border}` }} />
      ) : (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${border}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, color: txt, maxWidth: 200 }}>
          <span>{a.mediaType === "application/pdf" ? "📄" : "📝"}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
        </span>
      ))}
    </div>
  );
}

// ════════════ Administration (direction) ════════════

const champ: React.CSSProperties = { width: "100%", padding: "9px 11px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 14, boxSizing: "border-box" };
const lab: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" };
const BLANK = { name: "", specialty: "", description: "", icon: "🤖", photo: "", cv: "", color: "#B8966A", model: "smart", systemPrompt: "", accessRoles: [] as string[], active: true, order: "0" };

function Manage({ onChanged }: { onChanged: () => void }) {
  const [agents, setAgents] = useState<AgentFull[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try { const url = await fileToAvatar(f); setForm(fm => ({ ...fm, photo: url })); } catch { /* ignore */ }
  };

  const load = useCallback(() => {
    fetch("/api/ai-agents?admin=1").then(r => r.ok ? r.json() : null)
      .then(d => setAgents(d?.agents ?? [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing("new"); setForm({ ...BLANK }); };
  const startEdit = (a: AgentFull) => {
    setEditing(a.id);
    setForm({ name: a.name, specialty: a.specialty || "", description: a.description || "", icon: a.icon || "🤖", photo: a.photo || "", cv: a.cv || "", color: a.color || "#B8966A", model: a.model || "smart", systemPrompt: a.systemPrompt || "", accessRoles: a.accessRoles || [], active: a.active, order: String(a.order) });
  };

  const save = async () => {
    if (form.name.trim().length < 2 || saving) return;
    setSaving(true);
    const payload = { ...form, order: parseInt(form.order) || 0 };
    const res = editing === "new"
      ? await fetch("/api/ai-agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null)
      : await fetch(`/api/ai-agents/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    setSaving(false);
    if (res?.ok) { setEditing(null); load(); onChanged(); }
  };
  const remove = async (a: AgentFull) => {
    if (!confirm(`Supprimer l'assistant « ${a.name} » et toute sa base de connaissance ?`)) return;
    await fetch(`/api/ai-agents/${a.id}`, { method: "DELETE" }).catch(() => {});
    load(); onChanged();
  };
  const toggleRole = (id: string) => setForm(f => ({ ...f, accessRoles: f.accessRoles.includes(id) ? f.accessRoles.filter(r => r !== id) : [...f.accessRoles, id] }));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={startNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nouvel assistant</button>
      </div>

      {editing && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 200px" }}><label style={lab}>Nom</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Maître Léa" style={champ} /></div>
            <div style={{ flex: "0 1 90px" }}><label style={lab}>Icône</label><input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="⚖️" style={champ} /></div>
            <div style={{ flex: "0 1 90px" }}><label style={lab}>Couleur</label><input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ ...champ, padding: 4, height: 38 }} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lab}>Spécialité (accroche)</label><input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Juridique location & copropriété" style={champ} /></div>
          <div style={{ marginTop: 12 }}><label style={lab}>Description (carte)</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...champ, resize: "vertical", fontSize: 13 }} /></div>
          <div style={{ marginTop: 12 }}>
            <label style={lab}>Photo de l'agent</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Avatar a={{ photo: form.photo || null, icon: form.icon, color: form.color }} size={56} />
              <input ref={photoRef} type="file" accept="image/*" onChange={e => onPhoto(e.target.files?.[0])} style={{ display: "none" }} />
              <button onClick={() => photoRef.current?.click()} style={{ fontSize: 12.5, fontWeight: 700, color: GOLD, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>📷 Choisir une photo</button>
              <input value={form.photo.startsWith("data:") ? "" : form.photo} onChange={e => setForm(f => ({ ...f, photo: e.target.value }))} placeholder="…ou coller une URL d'image" style={{ ...champ, flex: "1 1 180px" }} />
              {form.photo && <button onClick={() => setForm(f => ({ ...f, photo: "" }))} style={{ fontSize: 12, fontWeight: 700, color: RED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>Retirer</button>}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>Sans photo, l'emoji sert d'avatar. L'image importée est redimensionnée automatiquement.</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={lab}>CV (présentation à l'humour, affichée sur la fiche)</label>
            <textarea value={form.cv} onChange={e => setForm(f => ({ ...f, cv: e.target.value }))} rows={6} placeholder={"🎓 Formation : …\n💼 Expérience : …\n🏆 Spécialités : …\n😎 Le petit plus : …"} style={{ ...champ, resize: "vertical", fontSize: 13, lineHeight: 1.5 }} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ flex: "1 1 240px" }}><label style={lab}>Modèle Anthropic</label>
              <select
                value={isPresetModel(form.model) ? form.model : CUSTOM}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, model: v === CUSTOM ? (isPresetModel(f.model) ? "" : f.model) : v })); }}
                style={champ}>
                {MODEL_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                <option value={CUSTOM}>Autre modèle Anthropic…</option>
              </select>
              {!isPresetModel(form.model) && (
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Identifiant du modèle (ex. claude-…)" style={{ ...champ, marginTop: 8 }} />
              )}
            </div>
            <div style={{ flex: "0 1 90px" }}><label style={lab}>Ordre</label><input inputMode="numeric" value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} style={champ} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lab}>Prompt système (personnalité & règles)</label>
            <textarea value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={6} placeholder="Tu es… Tu réponds en français…" style={{ ...champ, resize: "vertical", fontSize: 13, lineHeight: 1.5 }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={lab}>Accès (aucune case = tout le monde)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ROLES.map(r => (
                <button key={r.id} onClick={() => toggleRole(r.id)} style={{
                  background: form.accessRoles.includes(r.id) ? GOLD_BG : "#fff", color: form.accessRoles.includes(r.id) ? GOLD : "#6b7280",
                  border: `1px solid ${form.accessRoles.includes(r.id) ? GOLD : BORDER}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{r.label}</button>
              ))}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: DARK, cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /> Actif (visible dans la galerie)
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditing(null)} style={{ background: "#fff", color: "#6b7280", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={form.name.trim().length < 2 || saving} style={{ background: form.name.trim().length < 2 ? "#d1d5db" : GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: form.name.trim().length < 2 ? "default" : "pointer" }}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
          {editing !== "new" && <KnowledgeBase agentId={editing!} docs={agents.find(a => a.id === editing)?.docs || []} chunks={agents.find(a => a.id === editing)?._count?.chunks || 0} onChanged={load} />}
        </div>
      )}

      {!agents.length && <div style={{ color: "#9ca3af", fontSize: 13, padding: 24, textAlign: "center" }}>Aucun assistant. Créez le premier !</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {agents.map(a => (
          <div key={a.id} style={{ display: "flex", gap: 14, alignItems: "center", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, opacity: a.active ? 1 : 0.55 }}>
            <Avatar a={a} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{a.name} {!a.active && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>(inactif)</span>}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{a.specialty || "—"} · {modelLabel(a.model)} · {a.docs?.length || 0} doc(s), {a._count?.chunks || 0} fragment(s)</div>
            </div>
            <button onClick={() => startEdit(a)} style={{ fontSize: 12, fontWeight: 700, color: BLUE, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Configurer</button>
            <button onClick={() => remove(a)} style={{ fontSize: 16, color: RED, background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════ Base de connaissance ════════════

function KnowledgeBase({ agentId, docs, chunks, onChanged }: { agentId: string; docs: Doc[]; chunks: number; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result || ""));
    reader.readAsText(f);
  };
  const add = async () => {
    if (content.trim().length < 10 || adding) return;
    setAdding(true);
    const res = await fetch(`/api/ai-agents/${agentId}/docs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Document", content }),
    }).then(r => r.json()).catch(() => null);
    setAdding(false);
    if (res?.ok) { setName(""); setContent(""); onChanged(); }
  };
  const del = async (docId: string) => {
    if (!confirm("Retirer ce document de la base de connaissance ?")) return;
    await fetch(`/api/ai-agents/${agentId}/docs/${docId}`, { method: "DELETE" }).catch(() => {});
    onChanged();
  };

  return (
    <div style={{ marginTop: 18, borderTop: `1px dashed ${BORDER}`, paddingTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: DARK, marginBottom: 4 }}>📚 Base de connaissance</div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 12 }}>
        Documents internes (procédures, barèmes, mentions légales…). Texte indexé pour la recherche sémantique. {chunks} fragment(s) au total.
      </div>

      {docs.map(d => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FAF8F5", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 11px", marginBottom: 7 }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{(d.chars / 1000).toFixed(1)} k caractères · {new Date(d.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
          <button onClick={() => del(d.id)} style={{ fontSize: 15, color: RED, background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
      ))}

      <div style={{ marginTop: 10, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Titre du document" style={{ ...champ, flex: "1 1 200px" }} />
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,text/*" onChange={e => onFile(e.target.files?.[0])} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} style={{ fontSize: 12.5, fontWeight: 700, color: GOLD, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>📎 Fichier .txt/.md</button>
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Collez ici le texte du document (ou importez un fichier)…" style={{ ...champ, resize: "vertical", fontSize: 13 }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={add} disabled={content.trim().length < 10 || adding} style={{ background: content.trim().length < 10 ? "#d1d5db" : GREEN, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: content.trim().length < 10 ? "default" : "pointer" }}>{adding ? "Indexation…" : "Ajouter à la base"}</button>
        </div>
      </div>
    </div>
  );
}
