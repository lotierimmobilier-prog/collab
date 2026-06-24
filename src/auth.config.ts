import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Config Edge-compatible (pas de DB, pas de Node-only modules)
// Utilisée dans le middleware
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user; // connecté = autorisé
    },
  },
};
