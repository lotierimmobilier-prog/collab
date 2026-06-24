"use client";
import { useState } from "react";
import { GCalendar, GCalConfig } from "@/lib/googleCalendar";

interface Props {
  config: GCalConfig | null;
  connected: boolean;
  calendars: GCalendar[];
  syncing: boolean;
  syncError: string | null;
  onConnect: (cfg: GCalConfig) => void;
  onDisconnect: () => void;
  onToggleCalendar: (id: string, selected: boolean) => void;
  onClose: () => void;
  onSync: () => void;
}

export default function GoogleSyncPanel(props: Props) {
  const { config, connected, calendars, syncing, syncError, onConnect, onDisconnect, onToggleCalendar, onClose, onSync } = props;
  const [clientId, setClientId] = useState(config?.clientId ?? "");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
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
              {connected ? `${calendars.filter(c => c.selected).length} agenda(s) synchronisé(s)` : "Non connecté"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Status */}
          {connected ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>Connecté à Google Calendar</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Sélectionnez les agendas à synchroniser</div>
              </div>
              <button onClick={onSync} disabled={syncing} style={{ background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#166534" }}>
                {syncing ? "…" : "🔄 Sync"}
              </button>
            </div>
          ) : (
            <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>⚠ Non connecté</div>
              <div style={{ fontSize: 12, color: "#78350f" }}>Entrez votre Client ID Google pour synchroniser vos agendas.</div>
            </div>
          )}

          {syncError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#991b1b" }}>
              ⚠ {syncError}
            </div>
          )}

          {/* Config */}
          {!connected && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 12 }}>Configuration OAuth</div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                  Client ID Google *
                  <button onClick={() => setShowHelp(s => !s)} style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontSize: 12, marginLeft: 8 }}>
                    {showHelp ? "Masquer l'aide" : "Comment obtenir mon Client ID ?"}
                  </button>
                </div>
                <input
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="xxxxxxxx.apps.googleusercontent.com"
                  style={{ width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>

              {showHelp && (
                <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "14px", fontSize: 12, color: "#374151", lineHeight: 1.7, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 Étapes pour obtenir un Client ID Google :</div>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    <li>Aller sur <strong>console.cloud.google.com</strong></li>
                    <li>Créer un projet (ou en sélectionner un existant)</li>
                    <li>Activer l'API <strong>Google Calendar API</strong></li>
                    <li>Aller dans <strong>Identifiants → Créer des identifiants → ID client OAuth 2.0</strong></li>
                    <li>Type : <strong>Application Web</strong></li>
                    <li>Ajouter <code style={{ background: "#ede9fe", borderRadius: 3, padding: "1px 5px" }}>{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code> aux <strong>Origines JavaScript autorisées</strong></li>
                    <li>Copier le <strong>Client ID</strong> généré</li>
                  </ol>
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "#ede9fe", borderRadius: 6, fontSize: 11, color: "#7c3aed" }}>
                    ℹ Aucune clé secrète n'est stockée côté serveur. Le token OAuth est conservé uniquement dans votre navigateur.
                  </div>
                </div>
              )}

              <button
                onClick={() => clientId.trim() && onConnect({ clientId: clientId.trim() })}
                disabled={!clientId.trim()}
                style={{
                  width: "100%", background: clientId.trim() ? "#7c3aed" : "#e5e7eb",
                  color: clientId.trim() ? "#fff" : "#9ca3af",
                  border: "none", borderRadius: 8, padding: "10px", fontSize: 13,
                  fontWeight: 500, cursor: clientId.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span>🔗</span> Connecter Google Calendar
              </button>
            </div>
          )}

          {/* Calendar list */}
          {connected && calendars.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
                Mes agendas ({calendars.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {calendars.map(cal => (
                  <label key={cal.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    border: `1.5px solid ${cal.selected ? cal.backgroundColor : "#e5e7eb"}`,
                    borderRadius: 10, cursor: "pointer",
                    background: cal.selected ? cal.backgroundColor + "12" : "#fff",
                    transition: "all .15s",
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: cal.backgroundColor, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                        {cal.summary}
                        {cal.primary && <span style={{ fontSize: 10, background: "#f5f3ff", color: "#7c3aed", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>Principal</span>}
                      </div>
                      {cal.description && <div style={{ fontSize: 11, color: "#9ca3af" }}>{cal.description}</div>}
                    </div>
                    <div onClick={() => onToggleCalendar(cal.id, !cal.selected)} style={{
                      width: 38, height: 20, borderRadius: 10,
                      background: cal.selected ? cal.backgroundColor : "#e5e7eb",
                      position: "relative", cursor: "pointer", flexShrink: 0,
                      transition: "background .2s",
                    }}>
                      <div style={{ position: "absolute", top: 2, left: cal.selected ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {connected && calendars.length === 0 && !syncing && (
            <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13, color: "#9ca3af" }}>
              Aucun agenda trouvé
            </div>
          )}
        </div>

        {/* Footer */}
        {connected && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={onDisconnect} style={{ background: "none", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}>
              Déconnecter Google
            </button>
            <button onClick={onClose} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </>
  );
}
