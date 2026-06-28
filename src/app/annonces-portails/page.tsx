"use client";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const RED = "#DC2626"; const GREEN = "#2F855A";

const PLATFORMS = [
  { id: "leboncoin", label: "Leboncoin" },
  { id: "bienici",   label: "Bien'ici" },
  { id: "lefigaro",  label: "Le Figaro Immo" },
];
const pLabel = (id: string) => PLATFORMS.find(p => p.id === id)?.label ?? id;

interface Listing {
  id: string; platform: string; reference: string; title?: string | null; price?: string | null;
  type: string; agentName?: string | null; agentPhone?: string | null;
  ficheDriveItemId?: string | null; zelokLink?: string | null; active: boolean;
}
const EMPTY: Partial<Listing> = { platform: "leboncoin", type: "vente", active: true };

export default function AnnoncesPortailsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<Partial<Listing> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/portal-listings").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setListings(d.listings ?? []); setCanManage(!!d.canManage); }
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(l: Partial<Listing>) {
    const method = l.id ? "PATCH" : "POST";
    const r = await fetch("/api/portal-listings", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(l) });
    if (r.ok) { setEditing(null); load(); }
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Erreur"); }
  }
  async function remove(id: string) {
    if (!confirm("Supprimer cette annonce du registre ?")) return;
    await fetch(`/api/portal-listings?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="annonces-portails" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Annonces portails" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Réponses automatiques aux leads</div>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
                Reliez chaque annonce d'un portail (Leboncoin, Bien'ici, Le Figaro) à son type et à son agent.
                Quand un lead arrive, Auguste prépare un brouillon de réponse : <b>vente</b> → fiche complète + rappel de l'agent ;
                <b> gestion</b> → lien ZELOK pour le dossier locataire + rappel pour la visite. L'agent valide et envoie.
              </div>
            </div>

            {canManage && !editing && (
              <button onClick={() => setEditing({ ...EMPTY })} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>+ Ajouter une annonce</button>
            )}

            {editing && <ListingForm value={editing} onCancel={() => setEditing(null)} onSave={save} />}

            {loading ? <div style={{ color: "#9ca3af", padding: 30, textAlign: "center" }}>Chargement…</div>
             : listings.length === 0 ? <div style={{ color: "#9ca3af", padding: 30, textAlign: "center" }}>Aucune annonce enregistrée.</div>
             : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {listings.map(l => (
                  <div key={l.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, opacity: l.active ? 1 : 0.5 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: GOLD, background: GOLD_BG, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{pLabel(l.platform)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: l.type === "gestion" ? "#2563EB" : GREEN, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{l.type === "gestion" ? "Gestion" : "Vente"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>Réf. {l.reference}{l.title ? ` · ${l.title}` : ""}</div>
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        {l.agentName || "Agent ?"}{l.agentPhone ? ` · ${l.agentPhone}` : ""}
                        {l.type === "vente" && (l.ficheDriveItemId ? " · fiche ✓" : " · fiche manquante")}
                        {l.type === "gestion" && (l.zelokLink ? " · ZELOK ✓" : " · lien ZELOK manquant")}
                      </div>
                    </div>
                    {canManage && (
                      <>
                        <button onClick={() => setEditing(l)} style={miniBtn}>✏</button>
                        <button onClick={() => remove(l.id)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingForm({ value, onCancel, onSave }: { value: Partial<Listing>; onCancel: () => void; onSave: (l: Partial<Listing>) => void }) {
  const [f, setF] = useState<Partial<Listing>>(value);
  const set = (k: keyof Listing, v: unknown) => setF(p => ({ ...p, [k]: v }));
  return (
    <div style={{ background: "#fff", border: `1px solid ${GOLD}`, borderRadius: 12, padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{value.id ? "Modifier l'annonce" : "Nouvelle annonce"}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label="Plateforme"><select value={f.platform} onChange={e => set("platform", e.target.value)} style={inp}>{PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        <Field label="Type"><select value={f.type} onChange={e => set("type", e.target.value)} style={inp}><option value="vente">Vente</option><option value="gestion">Gestion (location)</option></select></Field>
        <Field label="Référence de l'annonce"><input value={f.reference ?? ""} onChange={e => set("reference", e.target.value)} placeholder="ex. 2614532890" style={inp} /></Field>
        <Field label="Prix (optionnel)"><input value={f.price ?? ""} onChange={e => set("price", e.target.value)} placeholder="ex. 245 000 €" style={inp} /></Field>
      </div>
      <Field label="Titre / désignation (optionnel)" full><input value={f.title ?? ""} onChange={e => set("title", e.target.value)} placeholder="ex. Maison T4 - Carcassonne" style={{ ...inp, width: "100%" }} /></Field>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label="Nom de l'agent"><input value={f.agentName ?? ""} onChange={e => set("agentName", e.target.value)} placeholder="ex. Barbara" style={inp} /></Field>
        <Field label="Téléphone de l'agent"><input value={f.agentPhone ?? ""} onChange={e => set("agentPhone", e.target.value)} placeholder="ex. 06 12 34 56 78" style={inp} /></Field>
      </div>

      {f.type === "gestion" ? (
        <Field label="Lien ZELOK (dossier locataire)" full>
          <input value={f.zelokLink ?? ""} onChange={e => set("zelokLink", e.target.value)} placeholder="https://www.zelok.fr/..." style={{ ...inp, width: "100%" }} />
        </Field>
      ) : (
        <Field label="Fiche complète (PDF du drive)" full>
          <FichePicker value={f.ficheDriveItemId ?? null} onPick={(id, name) => { set("ficheDriveItemId", id); if (name && !f.title) set("title", name.replace(/\.[a-z0-9]+$/i, "")); }} />
        </Field>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: DARK, cursor: "pointer" }}>
          <input type="checkbox" checked={f.active !== false} onChange={e => set("active", e.target.checked)} style={{ accentColor: GOLD }} /> Active
        </label>
        <button onClick={() => onSave(f)} disabled={!f.reference?.trim()} style={{ marginLeft: "auto", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: f.reference?.trim() ? 1 : 0.5 }}>Enregistrer</button>
        <button onClick={onCancel} style={miniBtn}>Annuler</button>
      </div>
    </div>
  );
}

// Sélection de la fiche PDF via la recherche du drive personnel.
function FichePicker({ value, onPick }: { value: string | null; onPick: (id: string | null, name?: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; kind: string }[] | null>(null);
  const [picked, setPicked] = useState<string>("");
  async function search() {
    if (!q.trim()) return;
    const r = await fetch("/api/me/drive/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: q.trim() }) });
    const d = await r.json().catch(() => ({ results: [] }));
    setResults((d.results ?? []).filter((x: { kind: string }) => x.kind === "file"));
  }
  return (
    <div>
      {value && <div style={{ fontSize: 12, color: GREEN, marginBottom: 6 }}>✓ Fiche associée{picked ? ` : ${picked}` : ""} <button onClick={() => { onPick(null); setPicked(""); }} style={{ ...miniBtn, padding: "2px 8px", marginLeft: 6 }}>retirer</button></div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search(); } }} placeholder="Rechercher la fiche dans le drive…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={search} style={miniBtn}>Rechercher</button>
      </div>
      {results !== null && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
          {results.length === 0 ? <div style={{ fontSize: 12, color: "#9ca3af" }}>Aucun fichier trouvé.</div>
           : results.map(r => (
            <button key={r.id} onClick={() => { onPick(r.id, r.name); setPicked(r.name); setResults(null); }} style={{ textAlign: "left", border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, color: DARK, cursor: "pointer" }}>📄 {r.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: full ? "1 1 100%" : "1 1 200px", minWidth: 160 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>{label}</span>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box", width: "100%" };
const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: DARK, borderRadius: 7, padding: "6px 11px", fontSize: 12.5, cursor: "pointer" };
