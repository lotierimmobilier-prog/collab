"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const AMBER = "#B45309"; const GREEN = "#2F855A";

interface DocState { expiry: string | null; has: boolean; status: "ok" | "soon" | "expired" | "none" }
interface Data { name: string; insurance: DocState; urssaf: DocState }

const STATUS_UI: Record<string, { label: string; color: string }> = {
  ok:      { label: "À jour",          color: GREEN },
  soon:    { label: "Expire bientôt",  color: AMBER },
  expired: { label: "Expirée",         color: RED },
  none:    { label: "À fournir",       color: "#6b7280" },
};

function fileToB64(file: File): Promise<{ name: string; mime: string; size: number; data: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: String(r.result).split(",")[1] || "" });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function FournisseurPortal() {
  const params = useParams();
  const token = String(params?.token ?? "");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/public/fournisseur/${token}`);
    if (r.ok) setData(await r.json());
    else setError("Lien invalide ou expiré. Contactez votre agence.");
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: "100vh", background: "#F3F1EC", fontFamily: "'Inter', sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: GOLD, letterSpacing: "0.04em" }}>LOTIER IMMOBILIER</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Espace fournisseur — dépôt de vos justificatifs</div>
        </div>

        {loading ? <Card><div style={{ textAlign: "center", color: "#9ca3af" }}>Chargement…</div></Card>
         : error ? <Card><div style={{ textAlign: "center", color: RED }}>{error}</div></Card>
         : data && (
          <>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{data.name}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                Pour continuer à recevoir nos ordres de service, merci de déposer vos justificatifs à jour. Vos documents sont transmis de façon sécurisée à l'agence.
              </div>
            </Card>

            <UploadCard token={token} kind="insurance" title="🛡 Attestation d'assurance" subtitle="Décennale / RC professionnelle" state={data.insurance} onDone={load} />
            <UploadCard token={token} kind="urssaf" title="📄 Attestation de vigilance URSSAF" subtitle="Datant de moins de 6 mois" state={data.urssaf} onDone={load} />

            <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 18 }}>
              Une question ? Répondez simplement à l'email de l'agence.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UploadCard({ token, kind, title, subtitle, state, onDone }: { token: string; kind: "insurance" | "urssaf"; title: string; subtitle: string; state: DocState; onDone: () => void }) {
  const [expiry, setExpiry] = useState(state.expiry ? state.expiry.slice(0, 10) : "");
  const [file, setFile] = useState<{ name: string; mime: string; size: number; data: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const su = STATUS_UI[state.status];

  async function submit() {
    if (!file) return;
    setSaving(true);
    const r = await fetch(`/api/public/fournisseur/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, expiry: expiry || undefined, file }),
    });
    setSaving(false);
    if (r.ok) { setDone(true); setFile(null); onDone(); }
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Échec de l'envoi."); }
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{title}</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{subtitle}</div>
        </div>
        <span style={{ background: su.color + "20", color: su.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{su.label}</span>
      </div>
      {state.has && state.expiry && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Validité enregistrée : {new Date(state.expiry).toLocaleDateString("fr-FR")}</div>}

      {done ? <div style={{ color: GREEN, fontSize: 13, fontWeight: 600, marginTop: 8 }}>✓ Document reçu, merci !</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Date de fin de validité</div>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Fichier (PDF ou photo, max 20 Mo)</div>
            <input type="file" accept="image/*,.pdf" onChange={async e => { const fl = e.target.files?.[0]; if (fl) { if (fl.size > 20 * 1024 * 1024) { alert("Fichier trop volumineux (max 20 Mo)."); return; } setFile(await fileToB64(fl)); } }} style={{ fontSize: 13 }} />
            {file && <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>✓ {file.name}</div>}
          </div>
          <button onClick={submit} disabled={!file || saving} style={{ background: !file ? "#e5e7eb" : GOLD, color: !file ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: file ? "pointer" : "default", alignSelf: "flex-start" }}>
            {saving ? "Envoi…" : "Envoyer ce document"}
          </button>
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 14, outline: "none", background: "#f9fafb", boxSizing: "border-box" };
void GOLD_BG;
