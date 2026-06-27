"use client";
import type { GStatus } from "./PlanningBoard";

interface Props {
  status: GStatus | null;
  syncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleCalendar: (id: string, selected: boolean) => void;
  onClose: () => void;
  onSync: () => void;
}

export default function GoogleSyncPanel({ status, syncing, onConnect, onDisconnect, onToggleCalendar, onClose, onSync }: Props) {
  const connected = !!status?.connected;
  const configured = status?.configured !== false;
  const calendars = status?.calendars ?? [];
  const selected = status?.selected ?? [];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
        background: "#fff", zIndex: 50, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📅</span> Agendas Google Calendar
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {connected ? `${selected.length} agenda(s) affiché(s)${status?.email ? ` · ${status.email}` : ""}` : "Non connecté"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {connected ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>Connexion permanente active</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>L'agenda reste affiché sans reconnexion. Sélectionnez les agendas à afficher.</div>
              </div>
              <button onClick={onSync} disabled={syncing} style={{ background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#166534" }}>
                {syncing ? "…" : "🔄 Actualiser"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", gap: 16 }}>
              <div style={{ fontSize: 48 }}>📅</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#111827", marginBottom: 6 }}>Synchroniser votre agenda Google</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                  Connexion <strong>une seule fois</strong> : l'agenda restera affiché en permanence (planning et tableau de bord), sans avoir à se reconnecter.
                </div>
              </div>
              <button
                onClick={onConnect}
                disabled={!configured}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: configured ? "#fff" : "#f3f4f6",
                  border: "1.5px solid #e5e7eb", borderRadius: 10,
                  padding: "12px 24px", fontSize: 14, fontWeight: 600,
                  color: configured ? "#374151" : "#9ca3af",
                  cursor: configured ? "pointer" : "default",
                  boxShadow: configured ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  width: "100%", justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2c-7.6 0-14.2 4.8-17.7 11.7z"/><path fill="#FBBC05" d="M24 46c5.8 0 10.9-1.9 14.6-5.1l-6.7-5.5C29.9 36.9 27.1 38 24 38c-6.1 0-11.3-4.1-13.2-9.7l-7 5.4C7.5 41 15.2 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.4-2.4 4.4-4.5 5.9l6.7 5.5C42.7 36.5 46 31 46 24c0-1.3-.2-2.7-.5-4z"/></svg>
                Connecter avec Google
              </button>
              {!configured && (
                <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                  Configuration Google non disponible — l'administrateur doit définir GOOGLE_CLIENT_SECRET.
                </div>
              )}
            </div>
          )}

          {/* Liste des agendas */}
          {connected && calendars.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
                Mes agendas ({calendars.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {calendars.map(cal => {
                  const isSel = selected.includes(cal.id);
                  const color = cal.backgroundColor || "#4285F4";
                  return (
                    <label key={cal.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                      border: `1.5px solid ${isSel ? color : "#e5e7eb"}`,
                      borderRadius: 10, cursor: "pointer",
                      background: isSel ? color + "12" : "#fff",
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                          {cal.summary}
                          {cal.primary && <span style={{ fontSize: 10, background: "#F7F0E6", color: "#B8966A", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>Principal</span>}
                        </div>
                      </div>
                      <div onClick={() => onToggleCalendar(cal.id, !isSel)} style={{
                        width: 38, height: 20, borderRadius: 10,
                        background: isSel ? color : "#e5e7eb",
                        position: "relative", cursor: "pointer", flexShrink: 0,
                      }}>
                        <div style={{ position: "absolute", top: 2, left: isSel ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {connected && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={onDisconnect} style={{ background: "none", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}>
              Déconnecter
            </button>
            <button onClick={onClose} style={{ background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </>
  );
}
