"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { formatDuration } from "@/lib/activity";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";

interface PresenceRow { userId: string; userName: string; todaySeconds: number; weekSeconds: number; lastSeen: string }
interface LogRow { id: string; userName: string | null; kind: string; label: string | null; path: string | null; createdAt: string }

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminActivitePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";

  const [data, setData] = useState<{ presence: PresenceRow[]; logins: LogRow[]; actions: LogRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/activity");
      if (r.ok) setData(await r.json());
    } catch { /* silencieux */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin-activite" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Administration — Activité & connexions" />
        {!isAdmin ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>Réservé à l&apos;administration.</div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Temps de présence, connexions et actions des utilisateurs.</p>
                <button onClick={load} style={{ background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>↻ Actualiser</button>
              </div>

              {loading && <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40 }}>Chargement…</div>}

              {!loading && data && (
                <>
                  {/* Temps de présence */}
                  <Card title="Temps de présence (7 derniers jours)">
                    {data.presence.length === 0 ? <Empty /> : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>
                            <th style={{ ...th, textAlign: "left" }}>Utilisateur</th>
                            <th style={th}>Aujourd&apos;hui</th>
                            <th style={th}>7 jours</th>
                            <th style={{ ...th, textAlign: "right" }}>Dernière activité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.presence.map((p, i) => (
                            <tr key={p.userId} style={{ borderTop: "1px solid #f3f4f6", background: i === 0 ? GOLD_BG : "#fff" }}>
                              <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{p.userName}</td>
                              <td style={td}>{formatDuration(p.todaySeconds)}</td>
                              <td style={{ ...td, fontWeight: 700, color: GOLD }}>{formatDuration(p.weekSeconds)}</td>
                              <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{fmtDateTime(p.lastSeen)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>

                  {/* Connexions */}
                  <Card title="Connexions récentes">
                    {data.logins.length === 0 ? <Empty /> : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {data.logins.map(l => (
                          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f3f4f6", fontSize: 13 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: l.kind === "login" ? "#2F6B46" : "#9B2C2C", background: l.kind === "login" ? "#EAF2EC" : "#F5E9E6", borderRadius: 6, padding: "2px 8px", minWidth: 88, textAlign: "center" }}>
                              {l.kind === "login" ? "Connexion" : "Déconnexion"}
                            </span>
                            <span style={{ flex: 1, fontWeight: 600, color: DARK }}>{l.userName ?? "—"}</span>
                            <span style={{ color: "#9ca3af" }}>{fmtDateTime(l.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Actions */}
                  <Card title="Actions récentes (navigation)">
                    {data.actions.length === 0 ? <Empty /> : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {data.actions.map(a => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #f3f4f6", fontSize: 13 }}>
                            <span style={{ fontWeight: 600, color: DARK, minWidth: 150 }}>{a.userName ?? "—"}</span>
                            <span style={{ flex: 1, color: "#4b5563" }}>{a.label ?? a.path}</span>
                            <span style={{ color: "#9ca3af" }}>{fmtDateTime(a.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid #f3f4f6`, fontSize: 13, fontWeight: 700, color: DARK }}>{title}</div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
function Empty() { return <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 16 }}>Aucune donnée pour l&apos;instant.</div>; }

const th: React.CSSProperties = { padding: "8px 10px", textAlign: "center", fontWeight: 700 };
const td: React.CSSProperties = { padding: "9px 10px", textAlign: "center", color: "#374151" };
