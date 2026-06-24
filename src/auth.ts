import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  callbacks: {
    async signIn({ user }) {
      // Vérifie que l'email Google est enregistré et actif en BDD
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email?.toLowerCase() ?? "" },
      });
      return !!(dbUser?.active);
    },

    async session({ session }) {
      // Enrichit la session avec les données BDD
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email.toLowerCase() },
          select: { id: true, prenom: true, nom: true, roleId: true, accessOverrides: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.prenom = dbUser.prenom;
          session.user.nom = dbUser.nom;
          session.user.roleId = dbUser.roleId;
        }
      }
      return session;
    },
  },
});
