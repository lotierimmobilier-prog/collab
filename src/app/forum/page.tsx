"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { useIsMobile } from "@/lib/useIsMobile";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const MUTED = "#6b7280";

interface LastMsg { topicId: string; title: string; userName: string; at: string }
interface Category { id: string; name: string; description: string | null; icon: string | null; color: string | null; order: number; active: boolean; topicCount: number; messageCount: number; lastMessage: LastMsg | null }
interface TopicRow { id: string; categoryId: string; userName: string; title: string; pinned: boolean; locked: boolean; createdAt: string; lastReplyAt: string; replyCount: number; likeCount: number }
interface Reply { id: string; userId: string; userName: string; body: string; createdAt: string; likeCount: number; hasLiked: boolean }
interface TopicDetail {
  id: string; title: string; body: string; userId: string; userName: string; pinned: boolean; locked: boolean; createdAt: string;
  category: { id: string; name: string; icon: string | null; color: string | null };
  likeCount: number; hasLiked: boolean; replies: Reply[];
}

const champ: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" };
function timeAgo(d: string) {
  const t = new Date(d).getTime(); const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function ForumPage() {
  const isMobile = useIsMobile();
  const [isDir, setIsDir] = useState(false);
  const [uid, setUid] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [view, setView] = useState<"cats" | "topics" | "topic">("cats");
  const [selCat, setSelCat] = useState<Category | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topic, setTopic] = useState<TopicDetail | null>(null);

  const loadCats = useCallback(() => {
    fetch("/api/forum/categories").then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setCats(d.categories ?? []); setIsDir(!!d.isDir); } }).catch(() => {});
  }, []);
  useEffect(() => { loadCats(); }, [loadCats]);

  const openCat = (c: Category) => {
    setSelCat(c); setView("topics"); setTopics([]);
    fetch(`/api/forum/topics?category=${c.id}`).then(r => r.json()).then(d => setTopics(d?.topics ?? [])).catch(() => {});
  };
  const openTopic = (id: string) => {
    setView("topic"); setTopic(null);
    fetch(`/api/forum/topics/${id}`).then(r => r.json()).then(d => { if (d?.topic) { setTopic(d.topic); setUid(d.currentUserId || ""); setIsDir(!!d.isDir); } }).catch(() => {});
  };
  const reloadTopic = () => { if (topic) openTopic(topic.id); };
  const reloadTopics = () => { if (selCat) fetch(`/api/forum/topics?category=${selCat.id}`).then(r => r.json()).then(d => setTopics(d?.topics ?? [])).catch(() => {}); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="forum" />
      <main style={{ flex: 1, padding: isMobile ? "16px 12px" : "28px 32px", maxWidth: 980, margin: "0 auto", width: "100%", minWidth: 0 }}>
        <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, color: DARK, margin: 0 }}>🗣️ Forum de l'agence</h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 4, marginBottom: 18 }}>
          Un espace communautaire pour échanger, s'entraider et partager entre collègues.
        </p>

        {view === "cats" && <CategoriesView cats={cats} isDir={isDir} isMobile={isMobile} onOpen={openCat} onOpenTopic={openTopic} onChanged={loadCats} />}
        {view === "topics" && selCat && (
          <TopicsView cat={selCat} topics={topics} onBack={() => { setView("cats"); loadCats(); }} onOpen={openTopic} onReload={reloadTopics} />
        )}
        {view === "topic" && (
          <TopicView topic={topic} isDir={isDir} uid={uid} onBack={() => { setView("topics"); reloadTopics(); }} onReload={reloadTopic} onDeleted={() => { setView("topics"); reloadTopics(); }} />
        )}
      </main>
    </div>
  );
}

// ════════════ Catégories ════════════

// Index façon phpBB, aux couleurs de l'agence (or/crème), responsive.
const FORUM_COLS = "46px minmax(0,1fr) 60px 74px 196px";
const BAR_GRAD = "linear-gradient(180deg,#C4A878,#B8966A)";   // or agence

function CategoriesView({ cats, isDir, isMobile, onOpen, onOpenTopic, onChanged }: { cats: Category[]; isDir: boolean; isMobile: boolean; onOpen: (c: Category) => void; onOpenTopic: (id: string) => void; onChanged: () => void }) {
  const [manage, setManage] = useState(false);
  const colHead: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#F3E7D2", textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center", alignSelf: "center" };
  const stat: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: DARK, textAlign: "center", alignSelf: "center" };

  return (
    <div>
      {isDir && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setManage(m => !m)} style={{ background: "#fff", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {manage ? "Fermer la gestion" : "⚙️ Gérer les catégories"}
          </button>
        </div>
      )}
      {manage && <CategoryManager cats={cats} onChanged={onChanged} />}

      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {/* Barre de section (or agence) — en-têtes de colonnes sur grand écran */}
        {isMobile ? (
          <div style={{ background: BAR_GRAD, color: "#fff", padding: "9px 14px", fontSize: 13, fontWeight: 800 }}>Forum de l'agence</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: FORUM_COLS, gap: 8, background: BAR_GRAD, color: "#fff", padding: "9px 14px", alignItems: "center" }}>
            <span />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.2 }}>Forum de l'agence</span>
            <span style={colHead}>Sujets</span>
            <span style={colHead}>Messages</span>
            <span style={colHead}>Dernier message</span>
          </div>
        )}

        {/* Lignes (catégories = forums) */}
        {cats.map((c, i) => {
          const col = c.color || GOLD;
          const rowBg = i % 2 ? "#FBF8F3" : "#fff";
          const name = (
            <button onClick={() => onOpen(c)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontSize: 15, fontWeight: 800, color: DARK }}>
              {c.name}{!c.active && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}> (masquée)</span>}
            </button>
          );
          const lastMsg = c.lastMessage ? (
            <>
              <button onClick={() => onOpenTopic(c.lastMessage!.topicId)} title={c.lastMessage.title} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontSize: 12, fontWeight: 700, color: GOLD, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                {c.lastMessage.title}
              </button>
              <div style={{ marginTop: 2, fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>par <b style={{ color: "#4b5563" }}>{c.lastMessage.userName}</b> · {timeAgo(c.lastMessage.at)}</div>
            </>
          ) : <span style={{ color: "#b9b2a6", fontSize: 11.5 }}>Aucun message</span>;
          const folder = <div style={{ width: 42, height: 42, borderRadius: 10, background: `${col}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{c.icon || "💬"}</div>;

          if (isMobile) {
            // Mobile / tablette étroite : ligne empilée (pas de colonnes).
            return (
              <div key={c.id} style={{ display: "flex", gap: 12, padding: "12px 14px", background: rowBg, borderTop: i ? `1px solid ${BORDER}` : "none" }}>
                {folder}
                <div style={{ minWidth: 0, flex: 1 }}>
                  {name}
                  {c.description && <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{c.description}</div>}
                  <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6, fontWeight: 600 }}>{c.topicCount} sujet{c.topicCount > 1 ? "s" : ""} · {c.messageCount} message{c.messageCount > 1 ? "s" : ""}</div>
                  <div style={{ marginTop: 4 }}>{lastMsg}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: FORUM_COLS, gap: 8, alignItems: "center", padding: "12px 14px", background: rowBg, borderTop: i ? `1px solid ${BORDER}` : "none" }}>
              {folder}
              <div style={{ minWidth: 0 }}>
                {name}
                {c.description && <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{c.description}</div>}
              </div>
              <div style={stat}>{c.topicCount}</div>
              <div style={stat}>{c.messageCount}</div>
              <div style={{ minWidth: 0, alignSelf: "center" }}>{lastMsg}</div>
            </div>
          );
        })}
        {!cats.length && <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13, background: "#fff" }}>Aucune catégorie.</div>}
      </div>
    </div>
  );
}

const BLANK_CAT = { name: "", description: "", icon: "💬", color: "#B8966A", order: "0", active: true };
function CategoryManager({ cats, onChanged }: { cats: Category[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_CAT });
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4, display: "block" };

  const startNew = () => { setEditing("new"); setForm({ ...BLANK_CAT }); };
  const startEdit = (c: Category) => { setEditing(c.id); setForm({ name: c.name, description: c.description || "", icon: c.icon || "💬", color: c.color || "#B8966A", order: String(c.order), active: c.active }); };
  const save = async () => {
    if (form.name.trim().length < 2) return;
    const payload = { ...form, order: parseInt(form.order) || 0 };
    const r = editing === "new"
      ? await fetch("/api/forum/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/forum/categories/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) { setEditing(null); onChanged(); }
  };
  const del = async (c: Category) => { if (!confirm(`Supprimer la catégorie « ${c.name} » et tous ses sujets ?`)) return; await fetch(`/api/forum/categories/${c.id}`, { method: "DELETE" }); onChanged(); };

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {cats.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{c.icon || "💬"}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: DARK }}>{c.name}{!c.active && <span style={{ color: "#9ca3af", fontWeight: 400 }}> (masquée)</span>}</span>
            <button onClick={() => startEdit(c)} style={{ fontSize: 12, color: "#2563EB", background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "4px 9px", cursor: "pointer", fontWeight: 700 }}>Modifier</button>
            <button onClick={() => del(c)} style={{ fontSize: 14, color: RED, background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
        ))}
      </div>
      {editing ? (
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 160px" }}><label style={lab}>Nom</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={champ} /></div>
            <div style={{ flex: "0 1 80px" }}><label style={lab}>Icône</label><input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} style={champ} /></div>
            <div style={{ flex: "0 1 80px" }}><label style={lab}>Couleur</label><input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ ...champ, padding: 3, height: 38 }} /></div>
            <div style={{ flex: "0 1 70px" }}><label style={lab}>Ordre</label><input inputMode="numeric" value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} style={champ} /></div>
          </div>
          <div style={{ marginTop: 10 }}><label style={lab}>Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={champ} /></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 10, cursor: "pointer", color: DARK }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /> Visible
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditing(null)} style={{ background: "#fff", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={form.name.trim().length < 2} style={{ background: form.name.trim().length < 2 ? "#d1d5db" : GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <button onClick={startNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nouvelle catégorie</button>
      )}
    </div>
  );
}

// ════════════ Sujets d'une catégorie ════════════

function TopicsView({ cat, topics, onBack, onOpen, onReload }: { cat: Category; topics: TopicRow[]; onBack: () => void; onOpen: (id: string) => void; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [saving, setSaving] = useState(false);
  const col = cat.color || GOLD;

  const submit = async () => {
    if (title.trim().length < 3 || body.trim().length < 1 || saving) return;
    setSaving(true);
    const r = await fetch("/api/forum/topics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId: cat.id, title, body }) }).catch(() => null);
    setSaving(false);
    if (r?.ok) { setTitle(""); setBody(""); setShowForm(false); onReload(); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>← Catégories</button>
        <button onClick={() => setShowForm(v => !v)} style={{ background: col, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{showForm ? "Fermer" : "+ Nouveau sujet"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 24 }}>{cat.icon || "💬"}</span>
        <div><div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{cat.name}</div>{cat.description && <div style={{ fontSize: 12.5, color: MUTED }}>{cat.description}</div>}</div>
      </div>

      {showForm && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre du sujet" maxLength={160} style={{ ...champ, marginBottom: 10, fontWeight: 600 }} />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Votre message…" rows={4} maxLength={8000} style={{ ...champ, resize: "vertical", fontSize: 13.5 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={submit} disabled={title.trim().length < 3 || body.trim().length < 1 || saving} style={{ background: (title.trim().length < 3 || body.trim().length < 1) ? "#d1d5db" : col, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{saving ? "Publication…" : "Publier"}</button>
          </div>
        </div>
      )}

      {!topics.length && <div style={{ color: "#9ca3af", fontSize: 13, padding: 28, textAlign: "center" }}>Aucun sujet ici. Lancez la première discussion !</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {topics.map(t => (
          <button key={t.id} onClick={() => onOpen(t.id)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                {t.pinned && <span title="Épinglé" style={{ fontSize: 12 }}>📌</span>}
                {t.locked && <span title="Verrouillé" style={{ fontSize: 12 }}>🔒</span>}
                <span style={{ fontSize: 14.5, fontWeight: 700, color: DARK }}>{t.title}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>par {t.userName} · {timeAgo(t.lastReplyAt)}</div>
            </div>
            <div style={{ display: "flex", gap: 12, color: MUTED, fontSize: 12.5, flexShrink: 0 }}>
              <span title="Réponses">💬 {t.replyCount}</span>
              <span title="J'aime">❤️ {t.likeCount}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════ Sujet (détail) ════════════

function LikeBtn({ liked, count, onClick }: { liked: boolean; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: liked ? GOLD_BG : "#fff", color: liked ? GOLD : MUTED,
      border: `1px solid ${liked ? GOLD : BORDER}`, borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    }}>{liked ? "❤️" : "🤍"} {count}</button>
  );
}

function TopicView({ topic, isDir, uid, onBack, onReload, onDeleted }: { topic: TopicDetail | null; isDir: boolean; uid: string; onBack: () => void; onReload: () => void; onDeleted: () => void }) {
  const [reply, setReply] = useState(""); const [saving, setSaving] = useState(false);
  if (!topic) return <div style={{ color: "#9ca3af", fontSize: 13, padding: 28, textAlign: "center" }}>Chargement…</div>;
  const col = topic.category.color || GOLD;

  const like = async (kind: "topic" | "reply", refId: string) => {
    await fetch("/api/forum/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, refId }) }).catch(() => {});
    onReload();
  };
  const sendReply = async () => {
    if (reply.trim().length < 1 || saving) return;
    setSaving(true);
    const r = await fetch(`/api/forum/topics/${topic.id}/replies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) }).catch(() => null);
    setSaving(false);
    if (r?.ok) { setReply(""); onReload(); }
  };
  const moderate = async (data: Record<string, unknown>) => { await fetch(`/api/forum/topics/${topic.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => {}); onReload(); };
  const delTopic = async () => { if (!confirm("Supprimer ce sujet ?")) return; await fetch(`/api/forum/topics/${topic.id}`, { method: "DELETE" }).catch(() => {}); onDeleted(); };
  const delReply = async (id: string) => { if (!confirm("Supprimer cette réponse ?")) return; await fetch(`/api/forum/replies/${id}`, { method: "DELETE" }).catch(() => {}); onReload(); };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", fontWeight: 600, marginBottom: 12 }}>← {topic.category.icon || "💬"} {topic.category.name}</button>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderTop: `3px solid ${col}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          {topic.pinned && <span style={{ fontSize: 13 }}>📌</span>}
          {topic.locked && <span style={{ fontSize: 13 }}>🔒</span>}
          <h2 style={{ fontSize: 19, fontWeight: 800, color: DARK, margin: 0 }}>{topic.title}</h2>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>par <b style={{ color: MUTED }}>{topic.userName}</b> · {timeAgo(topic.createdAt)}</div>
        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{topic.body}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <LikeBtn liked={topic.hasLiked} count={topic.likeCount} onClick={() => like("topic", topic.id)} />
          {isDir && <button onClick={() => moderate({ pinned: !topic.pinned })} style={modBtn}>{topic.pinned ? "Désépingler" : "📌 Épingler"}</button>}
          {isDir && <button onClick={() => moderate({ locked: !topic.locked })} style={modBtn}>{topic.locked ? "🔓 Déverrouiller" : "🔒 Verrouiller"}</button>}
          {(isDir || topic.userId === uid) && <button onClick={delTopic} style={{ ...modBtn, color: RED, borderColor: "#fecaca" }}>Supprimer</button>}
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: "20px 0 10px" }}>{topic.replies.length} réponse{topic.replies.length > 1 ? "s" : ""}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {topic.replies.map(r => (
          <div key={r.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>par <b style={{ color: MUTED }}>{r.userName}</b> · {timeAgo(r.createdAt)}</div>
            <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.body}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <LikeBtn liked={r.hasLiked} count={r.likeCount} onClick={() => like("reply", r.id)} />
              {(isDir || r.userId === uid) && <button onClick={() => delReply(r.id)} style={{ fontSize: 11.5, color: RED, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Supprimer</button>}
            </div>
          </div>
        ))}
      </div>

      {topic.locked && !isDir ? (
        <div style={{ marginTop: 16, color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 14, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12 }}>🔒 Ce sujet est verrouillé : les réponses sont fermées.</div>
      ) : (
        <div style={{ marginTop: 16, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Votre réponse…" rows={3} maxLength={8000} style={{ ...champ, resize: "vertical", fontSize: 13.5 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={sendReply} disabled={reply.trim().length < 1 || saving} style={{ background: reply.trim().length < 1 ? "#d1d5db" : col, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{saving ? "Envoi…" : "Répondre"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const modBtn: React.CSSProperties = { fontSize: 12, color: MUTED, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontWeight: 700 };
