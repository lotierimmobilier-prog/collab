import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          prenom: user.prenom,
          nom: user.nom,
          roleId: user.roleId,
        };
      },
    }),
  ],

  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,          // session expire après 8h d'inactivité
    updateAge: 60 * 60,            // renouvellement du token toutes les heures
  },

  // Cookies sécurisés en production (HTTPS uniquement, SameSite strict)
  cookies: process.env.NODE_ENV === "production" ? {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict" as const,
        path: "/",
        secure: true,
      },
    },
    callbackUrl: {
      name: "__Secure-authjs.callback-url",
      options: { httpOnly: true, sameSite: "strict" as const, path: "/", secure: true },
    },
    csrfToken: {
      name: "__Host-authjs.csrf-token",
      options: { httpOnly: true, sameSite: "strict" as const, path: "/", secure: true },
    },
  } : undefined,

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.prenom = (user as Record<string, unknown>).prenom;
        token.nom = (user as Record<string, unknown>).nom;
        token.roleId = (user as Record<string, unknown>).roleId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.prenom = token.prenom as string;
      session.user.nom = token.nom as string;
      session.user.roleId = token.roleId as string;
      return session;
    },
  },
});
