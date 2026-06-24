import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F3F1EC", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "48px 40px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.08)", width: 380,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 160, marginBottom: 16 }} />
          <div style={{ fontSize: 14, color: "#A09880", letterSpacing: "0.05em" }}>
            Espace de gestion
          </div>
        </div>

        {/* Erreur accès refusé */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
            padding: "12px 16px", width: "100%", boxSizing: "border-box",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>
              Accès refusé
            </div>
            <div style={{ fontSize: 12, color: "#7f1d1d" }}>
              {error === "AccessDenied"
                ? "Votre compte Google n'est pas autorisé. Contactez votre administrateur."
                : "Une erreur est survenue. Veuillez réessayer."}
            </div>
          </div>
        )}

        {/* Bouton Google */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          style={{ width: "100%" }}
        >
          <button type="submit" style={{
            width: "100%", padding: "13px 20px",
            background: "#fff", border: "1.5px solid #E6E1D9",
            borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500,
            color: "#1C1A17", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12, transition: "border-color 0.2s, box-shadow 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>
        </form>

        <div style={{ fontSize: 11, color: "#C4B99A", textAlign: "center", lineHeight: 1.6 }}>
          Seuls les comptes autorisés par l'administrateur<br />peuvent accéder à cet espace.
        </div>
      </div>
    </div>
  );
}
