"use client";
import { useState, useEffect, use, useCallback } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6"; const GREEN = "#2F855A";

interface FileMeta { id: string; kind?: string; name: string; mime?: string; size?: number; at?: string; by?: string }
interface Msg { id: string; author: string; name: string; body: string; at: string }
interface Ods {
  ref: string; supplier?: string; interventionType?: string; title?: string; description?: string;
  address?: string; onSite?: { name?: string; phone?: string; role?: string } | null;
  keyAtAgency?: boolean; accessInfo?: string; urgency?: string; deadline?: string | null;
  quoteRequired?: boolean; status: string; photos: FileMeta[]; files: FileMeta[]; messages: Msg[];
}

const STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon", "envoyé": "Reçu", "accepté": "Accepté", en_cours: "En cours", "terminé": "Terminé", "annulé": "Annulé",
};

export default function InterventionPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [ods, setOds] = useState<Ods | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/ods/${token}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Lien indisponible."); return; }
      setOds(d);
    } catch { setError("Lien indisponible."); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true); setFlash("");
    try {
      const r = await fetch(`/api/public/ods/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, name }),
      });
      const d = await r.json();
      if (!r.ok) { setFlash(d.error || "Échec."); return false; }
      await load();
      return true;
    } catch { setFlash("Erreur réseau."); return false; }
    finally { setBusy(false); }
  }

  async function sendMsg() {
    if (!msg.trim()) return;
    if (await post({ action: "message", body: msg })) setMsg("");
  }

  async function uploadFiles(kind: string, fileList: FileList | null) {
    if (!fileList) return;
    const files: { name: string; mime: string; size: number; data: string }[] = [];
    for (const file of Array.from(fileList).slice(0, 12)) {
      if (file.size > 10 * 1024 * 1024) { setFlash(`« ${file.name} » dépasse 10 Mo.`); continue; }
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(file); });
      files.push({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data });
    }
    if (files.length) { await post({ action: "files", kind, files }); setFlash(`${files.length} fichier(s) déposé(s).`); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "#F3F1EC", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, fontFamily: "system-ui, sans-serif" };
  const card: React.CSSProperties = { width: "100%", maxWidth: 540, background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 14 };

  if (error) return <div style={wrap}><div style={{ ...card, padding: 28, textAlign: "center" }}><div style={{ fontSize: 34 }}>🔒</div><div style={{ fontWeight: 700, color: DARK, margin: "8px 0 4px" }}>Lien indisponible</div><div style={{ fontSize: 13, color: "#6b7280" }}>{error}</div></div></div>;
  if (!ods) return <div style={wrap}><div style={{ color: "#9ca3af", padding: 40 }}>Chargement…</div></div>;

  return (
    <div style={wrap}>
      {/* En-tête + détails */}
      <div style={card}>
        <div style={{ background: GOLD, padding: "16px 20px" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Ordre de service {ods.ref}</div>
          <div style={{ color: "#fff", opacity: 0.9, fontSize: 12.5, marginTop: 2 }}>Lotier Immobilier · {STATUS_LABEL[ods.status] ?? ods.status}</div>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: DARK }}>
          {ods.urgency === "urgent" && <div style={{ color: "#9B2C2C", fontWeight: 700 }}>⚠ Intervention urgente</div>}
          {ods.interventionType && <Row k="Type" v={ods.interventionType} />}
          <Row k="Objet" v={ods.title} />
          {ods.description && <Row k="Description" v={ods.description} />}
          {ods.address && <Row k="Lieu" v={ods.address} />}
          {ods.onSite && <Row k="Contact sur place" v={`${[ods.onSite.name, ods.onSite.phone].filter(Boolean).join(" — ")}${ods.onSite.role ? ` (${ods.onSite.role})` : ""}`} />}
          {ods.keyAtAgency && <Row k="Accès" v="Logement non loué — clés à l'agence" />}
          {ods.accessInfo && <Row k="Accès" v={ods.accessInfo} />}
          {ods.deadline && <Row k="Délai souhaité" v={new Date(ods.deadline).toLocaleDateString("fr-FR")} />}
          {ods.quoteRequired && <div style={{ background: GOLD_BG, borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>📝 Devis demandé avant intervention.</div>}
          {ods.photos.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", margin: "6px 0 4px" }}>Photos de l'agence</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ods.photos.map(p => (
                  <a key={p.id} href={`/api/public/ods/${token}?download=${p.id}`} target="_blank" rel="noreferrer">
                    {p.mime?.startsWith("image/")
                      ? <img src={`/api/public/ods/${token}?download=${p.id}`} alt={p.name} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: `1px solid ${BORDER}` }} />
                      : <span style={{ display: "inline-flex", width: 70, height: 70, alignItems: "center", justifyContent: "center", border: `1px solid ${BORDER}`, borderRadius: 8 }}>📄</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Votre identité */}
      <div style={card}>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: DARK, marginBottom: 6 }}>Votre nom (société)</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={ods.supplier || "Votre nom"} style={inp} />
        </div>
      </div>

      {/* Dépôt de pièces */}
      <div style={card}>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 10 }}>Déposer un document</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <UploadBtn label="📄 Devis" onPick={fl => uploadFiles("devis", fl)} accept="image/*,.pdf" busy={busy} />
            <UploadBtn label="🧾 Facture" onPick={fl => uploadFiles("facture", fl)} accept="image/*,.pdf" busy={busy} />
            <UploadBtn label="📷 Photos" onPick={fl => uploadFiles("photo", fl)} accept="image/*" busy={busy} />
          </div>
          {ods.files.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {ods.files.map(f => (
                <a key={f.id} href={`/api/public/ods/${token}?download=${f.id}`} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK, textDecoration: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
                  <span>{f.kind === "devis" ? "📄" : f.kind === "facture" ? "🧾" : "📷"}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{f.kind}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Statut */}
      <div style={card}>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 10 }}>Mettre à jour le statut</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["accepté", "J'accepte"], ["en_cours", "En cours"], ["terminé", "Terminé"], ["annulé", "Je refuse"]].map(([s, label]) => (
              <button key={s} onClick={() => post({ action: "status", status: s })} disabled={busy}
                style={{ border: `1px solid ${ods.status === s ? GREEN : BORDER}`, background: ods.status === s ? "#EAF4EE" : "#fff", color: DARK, borderRadius: 9, padding: "8px 12px", fontSize: 13, cursor: "pointer", fontWeight: ods.status === s ? 700 : 500 }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Échanges */}
      <div style={card}>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 10 }}>Échanges avec l'agence</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 10 }}>
            {ods.messages.length === 0 && <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Aucun message pour l'instant.</div>}
            {ods.messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.author === "fournisseur" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.author === "fournisseur" ? GOLD_BG : "#f3f4f6", borderRadius: 10, padding: "8px 11px" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{m.name} · {new Date(m.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</div>
                <div style={{ fontSize: 13.5, color: DARK, whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMsg(); }} placeholder="Votre message / remarque…" style={{ ...inp, flex: 1 }} />
            <button onClick={sendMsg} disabled={busy || !msg.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Envoyer</button>
          </div>
          {flash && <div style={{ fontSize: 12, color: flash.includes("Échec") || flash.includes("dépasse") || flash.includes("réseau") ? "#dc2626" : GREEN, marginTop: 8 }}>{flash}</div>}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>Lotier Immobilier — espace fournisseur sécurisé</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return <div><span style={{ color: "#9ca3af", fontSize: 12 }}>{k} : </span><span>{v}</span></div>;
}
function UploadBtn({ label, onPick, accept, busy }: { label: string; onPick: (fl: FileList | null) => void; accept: string; busy: boolean }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 9, padding: "9px 13px", fontSize: 13, cursor: busy ? "default" : "pointer", background: "#FCFAF6", fontWeight: 600 }}>
      {label}
      <input type="file" multiple accept={accept} disabled={busy} style={{ display: "none" }} onChange={e => { onPick(e.target.files); e.target.value = ""; }} />
    </label>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 15, color: DARK, outline: "none", background: "#fff", boxSizing: "border-box" };
