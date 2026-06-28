"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const RED = "#DC2626";

interface Account { network: string; url: string; label?: string }

const CONSEILS = [
  { t: "Régularité avant tout", d: "Publiez 3 à 4 fois par semaine à heures fixes (12h-13h et 18h-20h marchent bien). Mieux vaut régulier que parfait." },
  { t: "Le visuel d'abord", d: "Une belle photo lumineuse (ou une courte vidéo verticale) capte 90 % de l'attention. Soignez le premier plan, évitez le contre-jour." },
  { t: "Racontez une histoire", d: "Pas juste « T3 à vendre » : le quartier, la lumière du matin, l'école à 5 min… Donnez envie de s'y projeter." },
  { t: "Un seul appel à l'action", d: "Terminez toujours par une action claire : « Visite sur demande », « DM pour le dossier », « Lien en bio »." },
  { t: "Hashtags ciblés", d: "5 à 8 hashtags : mêlez large (#immobilier) et local (#immoCarcassonne, #aVendre + ville). Évitez les listes de 30." },
  { t: "Répondez vite", d: "Un commentaire ou un message sans réponse sous 1 h, c'est un contact perdu. Activez les notifications." },
];
const EXEMPLES = [
  { titre: "Nouveauté", texte: "🆕 Nouveauté ! Coup de cœur assuré pour cette maison de [ville] : [X] pièces, jardin exposé sud, au calme et proche commodités. Disponible à la visite dès cette semaine — écrivez-nous en message privé.\n#immobilier #aVendre #maison #[ville]" },
  { titre: "Bien vendu", texte: "✅ Vendu ! Encore un projet concrétisé pour nos clients. Merci pour votre confiance 🙏 Vous aussi vous pensez à vendre ? Estimation offerte, sans engagement.\n#vendu #immobilier #estimationgratuite #[ville]" },
  { titre: "Estimation offerte", texte: "💡 Vous vous demandez combien vaut votre bien aujourd'hui ? Notre équipe vous offre une estimation précise et gratuite, basée sur le marché réel de [ville]. Contactez-nous !\n#estimation #immobilier #[ville] #conseilimmo" },
];
const NETWORKS = ["Instagram", "Facebook", "LinkedIn", "TikTok"];
const STYLES = [
  { id: "pro", label: "Professionnel", emoji: "💼", desc: "Classique et rassurant" },
  { id: "luxe", label: "Luxe", emoji: "✨", desc: "Élégant, haut de gamme" },
  { id: "humour", label: "Humour", emoji: "😄", desc: "Léger, trait d'esprit" },
  { id: "jeune", label: "Jeune & punchy", emoji: "🔥", desc: "Dynamique, réseaux" },
  { id: "coupdecoeur", label: "Coup de cœur", emoji: "❤️", desc: "Émotion, storytelling" },
  { id: "info", label: "Informatif", emoji: "📋", desc: "Factuel, caractéristiques" },
];

export default function ReseauxPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastPost, setLastPost] = useState("");
  const load = useCallback(() => { fetch("/api/reseaux").then(r => r.ok ? r.json() : null).then(d => setAccounts(d?.accounts ?? [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="reseaux" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Réseaux sociaux" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
            <Accounts accounts={accounts} isAdmin={isAdmin} reload={load} />
            <Generator onPost={setLastPost} />
            <ImageStudio suggestedText={lastPost} />
            <Examples />
            <Tips />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: "#6b7280", margin: "3px 0 12px" }}>{sub}</div>}
      {!sub && <div style={{ height: 12 }} />}
      {children}
    </div>
  );
}

function Accounts({ accounts, isAdmin, reload }: { accounts: Account[]; isAdmin: boolean; reload: () => void }) {
  const [edit, setEdit] = useState<Account[]>(accounts);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEdit(accounts); }, [accounts]);
  async function save() {
    await fetch("/api/reseaux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", accounts: edit.filter(a => a.url.trim()) }) });
    setEditing(false); reload();
  }
  return (
    <Card title="Comptes de l'agence" sub="Retrouvez et partagez les réseaux officiels de Lotier Immobilier.">
      {!editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {accounts.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>Aucun compte renseigné.{isAdmin ? " Cliquez sur « Gérer » pour les ajouter." : ""}</div>}
          {accounts.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: DARK, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ fontSize: 16 }}>🔗</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.network}</span>
              <span style={{ fontSize: 12.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label || a.url}</span>
            </a>
          ))}
          {isAdmin && <button onClick={() => setEditing(true)} style={{ alignSelf: "flex-start", marginTop: 4, background: "#fff", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Gérer les comptes</button>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {edit.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select value={a.network} onChange={e => setEdit(p => p.map((x, j) => j === i ? { ...x, network: e.target.value } : x))} style={inp}>
                {NETWORKS.map(n => <option key={n}>{n}</option>)}
              </select>
              <input value={a.url} onChange={e => setEdit(p => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" style={{ ...inp, flex: 1, minWidth: 180 }} />
              <button onClick={() => setEdit(p => p.filter((_, j) => j !== i))} style={{ ...mini, color: RED, borderColor: "#fecaca" }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => setEdit(p => [...p, { network: "Instagram", url: "" }])} style={{ ...mini }}>+ Ajouter</button>
            <button onClick={save} style={{ marginLeft: "auto", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Enregistrer</button>
            <button onClick={() => { setEdit(accounts); setEditing(false); }} style={{ ...mini }}>Annuler</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Generator({ onPost }: { onPost?: (t: string) => void }) {
  const [network, setNetwork] = useState("Instagram");
  const [style, setStyle] = useState("pro");
  const [degree, setDegree] = useState(2); // 1 discret · 2 équilibré · 3 marqué
  const [brief, setBrief] = useState("");
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);
  async function gen(forStyle?: string) {
    const useStyle = forStyle ?? style;
    if (!brief.trim() || busy) return;
    if (forStyle) setStyle(forStyle);
    setBusy(true); setPost("");
    try {
      const r = await fetch("/api/reseaux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", brief, network, style: useStyle, degree }) });
      const d = await r.json().catch(() => ({}));
      const text = d.post || d.error || "—";
      setPost(text); onPost?.(text);
    } catch { setPost("Erreur réseau."); }
    finally { setBusy(false); }
  }
  return (
    <Card title="✦ Générateur de publication" sub="Décrivez le bien ou l'idée, choisissez un style — Auguste rédige un post prêt à publier (texte + hashtags).">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Réseau</span>
          <select value={network} onChange={e => setNetwork(e.target.value)} style={inp}>{NETWORKS.map(n => <option key={n}>{n}</option>)}</select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Style du post</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {STYLES.map(s => {
              const on = style === s.id;
              return (
                <button key={s.id} type="button" onClick={() => setStyle(s.id)} title={s.desc}
                  style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD_BG : "#fff", color: on ? DARK : "#6b7280", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                  <span>{s.emoji}</span>{s.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Degré du style</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {[{ d: 1, l: "Discret" }, { d: 2, l: "Équilibré" }, { d: 3, l: "Marqué" }].map(x => {
              const on = degree === x.d;
              return (
                <button key={x.d} type="button" onClick={() => setDegree(x.d)}
                  style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD_BG : "#fff", color: on ? DARK : "#6b7280", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                  <span style={{ letterSpacing: 1 }}>{"●".repeat(x.d)}<span style={{ opacity: 0.25 }}>{"●".repeat(3 - x.d)}</span></span>{x.l}
                </button>
              );
            })}
          </div>
        </div>
        <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="Ex. Maison T4 à Carcassonne, jardin sud 400 m², proche écoles, garage, à visiter ce week-end." rows={3} style={{ ...inp, height: "auto", padding: "10px 12px", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => gen()} disabled={!brief.trim() || busy} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !brief.trim() || busy ? 0.5 : 1 }}>{busy ? "Rédaction…" : "Générer le post"}</button>
          {post && !busy && <button onClick={() => gen()} style={{ ...mini }}>↻ Régénérer</button>}
        </div>
        {post && (
          <div style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55, color: DARK }}>
            {post}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <CopyBtn text={post} />
              <span style={{ fontSize: 11.5, color: "#9ca3af" }}>Essayer un autre style :</span>
              {STYLES.filter(s => s.id !== style).map(s => (
                <button key={s.id} onClick={() => gen(s.id)} disabled={busy} title={s.desc}
                  style={{ ...mini, padding: "4px 9px", fontSize: 11.5, opacity: busy ? 0.5 : 1 }}>{s.emoji} {s.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Création de visuel via Canva (Brand Template autofill). Trois états :
// non configuré (admin) · non connecté · connecté (choix du modèle + génération).
interface CanvaTpl { id: string; title: string; thumbnailUrl?: string }
function ImageStudio({ suggestedText }: { suggestedText?: string }) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [templates, setTemplates] = useState<CanvaTpl[]>([]);
  const [tpl, setTpl] = useState<string>("");
  const [fields, setFields] = useState<{ name: string; type: string }[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [err, setErr] = useState("");

  const loadStatus = useCallback(() => {
    fetch("/api/canva/status").then(r => r.ok ? r.json() : null).then(d => {
      setStatus(d);
      if (d?.connected) fetch("/api/canva/templates").then(r => r.json()).then(t => setTemplates(t.templates ?? [])).catch(() => {});
    }).catch(() => setStatus({ configured: false, connected: false }));
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Charge les champs du modèle choisi et pré-remplit le 1er champ texte.
  useEffect(() => {
    if (!tpl) { setFields([]); return; }
    fetch(`/api/canva/templates?id=${tpl}`).then(r => r.json()).then(d => {
      const fs = d.fields ?? [];
      setFields(fs);
      const firstText = fs.find((f: { type: string }) => f.type === "text");
      setValues(firstText && suggestedText ? { [firstText.name]: suggestedText } : {});
    }).catch(() => {});
  }, [tpl, suggestedText]);

  async function generate() {
    if (!tpl || busy) return;
    setBusy(true); setErr(""); setImgUrl("");
    try {
      const r = await fetch("/api/canva/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: tpl, fields: values }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) setImgUrl(d.url);
      else setErr(d.error || "Échec de la génération.");
    } catch { setErr("Erreur réseau."); }
    finally { setBusy(false); }
  }

  return (
    <Card title="🎨 Créer un visuel" sub="Générez une image à votre charte depuis un modèle Canva.">
      {/* Toujours disponible : raccourcis Canva manuels. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a href="https://www.canva.com/" target="_blank" rel="noreferrer" style={{ ...mini, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Ouvrir Canva ↗</a>
        <a href="https://www.canva.com/fr_fr/creer/publications-instagram/" target="_blank" rel="noreferrer" style={{ ...mini, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Modèles de posts immobiliers ↗</a>
      </div>

      {status === null ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Chargement…</div>
       : !status.configured ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: GOLD, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>En cours</span>
          <div style={{ fontSize: 12.5, color: "#6b6357", lineHeight: 1.5 }}>
            La génération automatique de visuels Canva est prête côté application : il reste à renseigner les
            identifiants de l’app Canva (CANVA_CLIENT_ID / SECRET / REDIRECT_URI). En attendant, utilisez Canva
            manuellement avec le texte généré ci-dessus.
          </div>
        </div>
      ) : !status.connected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: DARK, lineHeight: 1.55 }}>Connectez votre compte Canva pour générer un visuel à votre charte en un clic.</div>
          <a href="/api/canva/connect" style={{ alignSelf: "flex-start", background: GOLD, color: "#fff", textDecoration: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600 }}>Connecter Canva</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#6b6357", lineHeight: 1.5, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px" }}>
              Aucun modèle « autofill » trouvé dans votre Canva. Créez dans Canva un <b>Brand Template</b> (post carré
              1080×1080) à votre charte, ajoutez-y des <b>champs de données</b> (menu Données), puis revenez ici.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Modèle</span>
                <select value={tpl} onChange={e => setTpl(e.target.value)} style={{ ...inp, minWidth: 220 }}>
                  <option value="">— choisir —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              {fields.filter(f => f.type === "text").map(f => (
                <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 11.5, color: "#6b7280" }}>{f.name}</span>
                  <textarea value={values[f.name] ?? ""} onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))} rows={2}
                    style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical", fontFamily: "inherit" }} />
                </div>
              ))}
              {fields.some(f => f.type === "image") && <div style={{ fontSize: 11, color: "#9ca3af" }}>Astuce : les champs photo se remplissent directement dans Canva (l’upload depuis l’app arrive bientôt).</div>}
              {tpl && (
                <button onClick={generate} disabled={busy} style={{ alignSelf: "flex-start", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "Génération…" : "Générer le visuel"}</button>
              )}
            </>
          )}
          {err && <div style={{ fontSize: 12.5, color: RED }}>{err}</div>}
          {imgUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="Visuel généré" style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${BORDER}` }} />
              <a href={imgUrl} download target="_blank" rel="noreferrer" style={{ ...mini, textDecoration: "none", display: "inline-flex", alignItems: "center", alignSelf: "flex-start" }}>⬇ Télécharger</a>
            </div>
          )}
          <button onClick={() => { fetch("/api/canva/disconnect", { method: "POST" }).then(() => loadStatus()); }} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#9ca3af", fontSize: 11.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Déconnecter Canva</button>
        </div>
      )}
    </Card>
  );
}

function Examples() {
  return (
    <Card title="Exemples de publications" sub="Modèles prêts à adapter — remplacez les [crochets] par vos infos.">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {EXEMPLES.map(e => (
          <div key={e.titre} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 5 }}>{e.titre}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#3f3a33", lineHeight: 1.5 }}>{e.texte}</div>
            <div style={{ marginTop: 6 }}><CopyBtn text={e.texte} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Tips() {
  return (
    <Card title="Conseils & bonnes pratiques">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {CONSEILS.map(c => (
          <div key={c.t} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 3 }}>{c.t}</div>
            <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>{c.d}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}
      style={{ ...mini, color: ok ? "#059669" : DARK }}>{ok ? "✓ Copié" : "Copier"}</button>
  );
}

const inp: React.CSSProperties = { height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" };
const mini: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: DARK, borderRadius: 7, padding: "6px 11px", fontSize: 12.5, cursor: "pointer" };
