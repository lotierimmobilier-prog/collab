import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { getExtra } from "@/lib/user-extras";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Sélection explicite des seules colonnes nécessaires : la connexion
        // ne doit jamais dépendre de colonnes récentes (évite tout 500 si une
        // migration n'est pas encore appliquée sur l'instance).
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
          select: {
            id: true, email: true, passwordHash: true, active: true,
            prenom: true, nom: true, roleId: true,
          },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;

        // Statut super admin : adresse d'origine (bootstrap) OU flag user_extras.
        let superAdmin = isSuperAdminEmail(user.email);
        if (!superAdmin) {
          try { superAdmin = (await getExtra(user.id))?.superAdmin === true; } catch { /* best-effort */ }
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          prenom: user.prenom,
          nom: user.nom,
          roleId: user.roleId,
          superAdmin,
        };
      },
    }),
  ],

  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    // Connexion maintenue 30 jours : le cookie « glisse » (renouvelé à chaque
    // journée d'activité), donc un agent qui utilise le logiciel reste connecté
    // en continu et n'a pas à se reconnecter sans cesse.
    maxAge: 30 * 24 * 60 * 60,     // 30 jours d'inactivité avant expiration
    updateAge: 24 * 60 * 60,        // renouvellement du token une fois par jour
  },

  // Cookies sécurisés en production (HTTPS uniquement).
  // Le cookie de session est en SameSite=Lax (et non Strict) : Strict empêche
  // le navigateur de renvoyer la session au retour d'un site externe (Google
  // OAuth) → la connexion Google échouait (« Non authentifié ») et l'utilisateur
  // était rebondi vers le login. Lax autorise ce retour (navigation GET de
  // premier niveau) tout en bloquant les requêtes cross-site (protection CSRF).
  cookies: process.env.NODE_ENV === "production" ? {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
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

  events: {
    async signIn({ user }) {
      try {
        await prisma.activityLog.create({ data: { userId: user.id, userName: user.name ?? null, kind: "login", label: "Connexion" } });
      } catch { /* journalisation best-effort */ }
    },
    async signOut(message) {
      try {
        const token = (message as { token?: { id?: string; name?: string } }).token;
        if (token?.id) await prisma.activityLog.create({ data: { userId: token.id, userName: token.name ?? null, kind: "logout", label: "Déconnexion" } });
      } catch { /* best-effort */ }
    },
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = (user as Record<string, unknown>).email as string | null;
        token.prenom = (user as Record<string, unknown>).prenom;
        token.nom = (user as Record<string, unknown>).nom;
        token.roleId = (user as Record<string, unknown>).roleId;
        token.superAdmin = (user as Record<string, unknown>).superAdmin === true;
      }

      // « Prendre la main » sur un utilisateur (impersonation) — réservé admin.
      // Enveloppé : une erreur ici ne doit jamais casser la session.
      if (trigger === "update" && session && typeof session === "object") {
        const sel = { id: true, prenom: true, nom: true, roleId: true, email: true } as const;
        try {
          const imp = (session as Record<string, unknown>).impersonate;
          if (imp === null) {
            // Retour à l'administration : on restaure l'identité d'origine.
            if (token.impersonatorId) {
              const admin = await prisma.user.findUnique({ where: { id: token.impersonatorId as string }, select: sel });
              if (admin) {
                token.id = admin.id; token.prenom = admin.prenom; token.nom = admin.nom;
                token.roleId = admin.roleId; token.name = `${admin.prenom} ${admin.nom}`;
                token.email = admin.email;
                // Le statut super admin n'est restauré que pour l'adresse d'origine
                // (les super admins désignés via flag doivent se reconnecter).
                token.superAdmin = isSuperAdminEmail(admin.email);
              }
              token.impersonatorId = undefined;
              token.impersonatorName = undefined;
            }
          } else if (typeof imp === "string" && imp) {
            // Démarrage : uniquement si l'utilisateur effectif est admin et n'impersonne pas déjà.
            if (token.roleId === "admin" && !token.impersonatorId) {
              const target = await prisma.user.findUnique({ where: { id: imp }, select: sel });
              // Un admin non super ne peut pas « prendre la main » sur le super admin d'origine.
              const blocked = target && isSuperAdminEmail(target.email) && token.superAdmin !== true;
              if (target && target.id !== token.id && !blocked) {
                token.impersonatorId = token.id;
                token.impersonatorName = token.name ?? `${token.prenom} ${token.nom}`;
                token.id = target.id; token.prenom = target.prenom; token.nom = target.nom;
                token.roleId = target.roleId; token.name = `${target.prenom} ${target.nom}`;
                token.email = target.email;
                // L'impersonation ne confère jamais les pouvoirs de super admin.
                token.superAdmin = false;
              }
            }
          }
        } catch { /* impersonation best-effort : on ne casse pas la session */ }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.prenom = token.prenom as string;
      session.user.nom = token.nom as string;
      session.user.roleId = token.roleId as string;
      // Le super admin d'origine (adresse codée en dur) l'est toujours, même si
      // le flag du jeton manque (anciennes sessions) ; sinon on suit le jeton.
      session.user.superAdmin = token.superAdmin === true || isSuperAdminEmail(token.email as string | undefined);
      session.user.impersonatorId = (token.impersonatorId as string) ?? null;
      session.user.impersonatorName = (token.impersonatorName as string) ?? null;
      return session;
    },
  },
});
